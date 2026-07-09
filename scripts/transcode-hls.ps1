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
  h264 + aac, 6-second segments, VOD playlists. Variants above -MaxHeight are skipped.

.EXAMPLE
  .\scripts\transcode-hls.ps1 -Input "D:\masters\tom-yum.mkv" -Slug tom-yum
  .\scripts\transcode-hls.ps1 -Input movie.mp4 -Slug my-movie -MaxHeight 720
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
  [int]$MaxHeight = 1080
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
  Write-Error "ffmpeg PATH дээр олдсонгүй. https://ffmpeg.org/download.html -оос суулгана уу."
}
if (-not (Test-Path -LiteralPath $InputFile)) {
  Write-Error "Оролтын файл олдсонгүй: $InputFile"
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
$ladder = @($allRungs | Where-Object { $_.Height -le $MaxHeight })

if ($ladder.Count -eq 0) { Write-Error "MaxHeight=$MaxHeight-д тохирох чанар алга." }

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
  if ($LASTEXITCODE -ne 0) { Write-Error "ffmpeg exit code $LASTEXITCODE - transcode амжилтгүй." }
}
finally {
  Pop-Location
}

Write-Host ""
Write-Host "==> Done: $outDir" -ForegroundColor Green
Write-Host ""
Write-Host "Дараагийн алхам — R2 руу хуулах (rclone тохиргоо: docs/14-r2-video.md):" -ForegroundColor Yellow
Write-Host ""
Write-Host "  rclone copy ./hls-out/$Slug r2:flimix-videos/movies/$Slug --transfers 8 --progress"
Write-Host ""
Write-Host "Админ дээр video asset бөглөх утгууд:" -ForegroundColor Yellow
Write-Host "  Провайдер           : Cloudflare R2 (r2)"
Write-Host "  Провайдерын видео ID: $Slug"
Write-Host "  HLS зам             : /movies/$Slug/master.m3u8"
Write-Host "  Чанарууд            : $(($ladder | ForEach-Object { $_.Name }) -join ', ')"
