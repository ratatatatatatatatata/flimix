<#
.SYNOPSIS
  FLIMIX: transcode a movie file to a multi-bitrate HLS ladder for Cloudflare R2.

.DESCRIPTION
  Requires ffmpeg in PATH. Produces ./hls-out/{slug}/ with:
    master.m3u8
    1080p/index.m3u8 + seg_0000.ts ...   (5000k)
    720p/index.m3u8  + seg_0000.ts ...   (2800k)
    480p/index.m3u8  + seg_0000.ts ...   (1400k)
    360p/index.m3u8  + seg_0000.ts ...   (800k)
  h264 + aac, 6-second segments, VOD playlists.
  Rungs outside -MinHeight..-MaxHeight are skipped (default: 720p + 1080p only).

  NOTE: keep this file ASCII-only. Windows PowerShell 5.1 misreads BOM-less
  UTF-8 scripts, and non-ASCII strings break parsing.

.EXAMPLE
  .\scripts\transcode-hls.ps1 -InputFile "D:\masters\tom-yum.mkv" -Slug tom-yum
  .\scripts\transcode-hls.ps1 -InputFile movie.mp4 -Slug my-movie -MinHeight 360
#>
[CmdletBinding()]
param(
  # Source video file ($Input is a reserved automatic variable, hence the alias)
  [Parameter(Mandatory = $true, Position = 0)]
  [Alias("Input", "i")]
  [string]$InputFile,

  # URL-safe folder name, e.g. "tom-yum" -> r2:flimix-videos/movies/tom-yum
  [Parameter(Mandatory = $true, Position = 1)]
  [ValidatePattern("^[a-z0-9]+(-[a-z0-9]+)*$")]
  [string]$Slug,

  [ValidateSet(360, 480, 720, 1080)]
  [int]$MaxHeight = 1080,

  # Lowest rung to produce. Default 720 = skip 360p/480p (saves transcode
  # time, upload time and storage). Pass -MinHeight 360 for the full ladder.
  [ValidateSet(360, 480, 720, 1080)]
  [int]$MinHeight = 720
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
  Write-Error "ffmpeg not found in PATH. Install it: winget install Gyan.FFmpeg"
}
if (-not (Test-Path -LiteralPath $InputFile)) {
  Write-Error "Input file not found: $InputFile"
}
$InputFile = (Resolve-Path -LiteralPath $InputFile).Path

# Bitrate ladder (height, video bitrate, maxrate, bufsize, audio bitrate).
# @(...) keeps the result an array even when only one rung survives the filter.
$allRungs = @(
  @{ Name = "1080p"; Height = 1080; VBitrate = "5000k"; MaxRate = "5350k"; BufSize = "7500k"; ABitrate = "192k" },
  @{ Name = "720p";  Height = 720;  VBitrate = "2800k"; MaxRate = "2996k"; BufSize = "4200k"; ABitrate = "128k" },
  @{ Name = "480p";  Height = 480;  VBitrate = "1400k"; MaxRate = "1498k"; BufSize = "2100k"; ABitrate = "128k" },
  @{ Name = "360p";  Height = 360;  VBitrate = "800k";  MaxRate = "856k";  BufSize = "1200k"; ABitrate = "96k" }
)
$ladder = @($allRungs | Where-Object { $_.Height -le $MaxHeight -and $_.Height -ge $MinHeight })

if ($ladder.Count -eq 0) { Write-Error "No ladder rung fits MinHeight=$MinHeight..MaxHeight=$MaxHeight." }

$outDir = Join-Path (Get-Location) "hls-out/$Slug"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

# Build the filter graph: split the video N ways, scale each rung.
$n = $ladder.Count
$splitOuts = ((0..($n - 1)) | ForEach-Object { "[v$_]" }) -join ""
$filters = @("[0:v]split=$n$splitOuts")
for ($i = 0; $i -lt $n; $i++) {
  $filters += "[v$i]scale=-2:$($ladder[$i].Height)[v${i}out]"
}
$filterComplex = $filters -join ";"

$ffArgs = @("-y", "-i", $InputFile, "-filter_complex", $filterComplex)

# Per-variant video + audio encoding settings.
for ($i = 0; $i -lt $n; $i++) {
  $rung = $ladder[$i]
  $ffArgs += @(
    "-map", "[v${i}out]",
    "-c:v:$i", "libx264",
    "-profile:v:$i", "main",
    "-b:v:$i", $rung.VBitrate,
    "-maxrate:v:$i", $rung.MaxRate,
    "-bufsize:v:$i", $rung.BufSize
  )
}
for ($i = 0; $i -lt $n; $i++) {
  $rung = $ladder[$i]
  $ffArgs += @("-map", "a:0", "-c:a:$i", "aac", "-b:a:$i", $rung.ABitrate, "-ac:a:$i", "2")
}

# Keyframes every 6s so segment boundaries align across variants.
$ffArgs += @(
  "-preset", "medium",
  "-sc_threshold", "0",
  "-force_key_frames", "expr:gte(t,n_forced*6)"
)

# HLS muxer: independent variant playlists + master.m3u8.
$varStreamMap = ((0..($n - 1)) | ForEach-Object { "v:$_,a:$_,name:$($ladder[$_].Name)" }) -join " "
$ffArgs += @(
  "-f", "hls",
  "-hls_time", "6",
  "-hls_playlist_type", "vod",
  "-hls_flags", "independent_segments",
  "-hls_segment_filename", "%v/seg_%04d.ts",
  "-master_pl_name", "master.m3u8",
  "-var_stream_map", $varStreamMap,
  "%v/index.m3u8"
)

Write-Host "==> Transcoding '$InputFile' -> $outDir" -ForegroundColor Cyan
Write-Host "    Ladder: $(($ladder | ForEach-Object { $_.Name }) -join ', ')" -ForegroundColor Cyan

# Run ffmpeg from inside the output dir so master.m3u8 lands at its root
# and variant playlists reference segments relatively.
Push-Location $outDir
try {
  & ffmpeg @ffArgs
  if ($LASTEXITCODE -ne 0) { Write-Error "ffmpeg exited with code $LASTEXITCODE - transcode failed." }
}
finally {
  Pop-Location
}

Write-Host ""
Write-Host "==> Done: $outDir" -ForegroundColor Green
Write-Host ""
Write-Host "Next step - upload to R2 (rclone setup: docs/14-r2-video.md):" -ForegroundColor Yellow
Write-Host ""
Write-Host "  rclone copy ./hls-out/$Slug r2:flimix-videos/movies/$Slug --transfers 64 --progress"
Write-Host ""
Write-Host "Admin video asset values:" -ForegroundColor Yellow
Write-Host "  Provider          : Cloudflare R2 (r2)"
Write-Host "  Provider video ID : $Slug"
Write-Host "  HLS path          : /movies/$Slug/master.m3u8"
Write-Host "  Qualities         : $(($ladder | ForEach-Object { $_.Name }) -join ', ')"
