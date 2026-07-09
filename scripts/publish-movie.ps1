<#
.SYNOPSIS
  FLIMIX: one command to publish a movie -> transcode to HLS + upload to R2.

.DESCRIPTION
  Runs transcode-hls.ps1, then uploads ./hls-out/{slug} to
  r2:flimix-videos/movies/{slug} with rclone, then prints the values
  to enter in the FLIMIX admin panel.

  Requires: ffmpeg + rclone in PATH, rclone remote named "r2"
  (setup guide: docs/14-r2-video.md).

  NOTE: keep this file ASCII-only (PowerShell 5.1 encoding quirks).

.EXAMPLE
  .\scripts\publish-movie.ps1 -InputFile "D:\masters\my-movie.mp4" -Slug my-movie
  .\scripts\publish-movie.ps1 -InputFile movie.mkv -Slug my-movie -MinHeight 360 -KeepLocal
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [Alias("Input", "i")]
  [string]$InputFile,

  [Parameter(Mandatory = $true, Position = 1)]
  [ValidatePattern("^[a-z0-9]+(-[a-z0-9]+)*$")]
  [string]$Slug,

  [ValidateSet(360, 480, 720, 1080)]
  [int]$MaxHeight = 1080,

  # Lowest rung to produce. Default 720 = skip 360p/480p.
  [ValidateSet(360, 480, 720, 1080)]
  [int]$MinHeight = 720,

  # Keep ./hls-out/{slug} after a successful upload (default: delete to save disk)
  [switch]$KeepLocal
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command rclone -ErrorAction SilentlyContinue)) {
  Write-Error "rclone not found in PATH. Install: winget install Rclone.Rclone"
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# --- Step 1: transcode ---------------------------------------------------
& (Join-Path $scriptDir "transcode-hls.ps1") -InputFile $InputFile -Slug $Slug -MaxHeight $MaxHeight -MinHeight $MinHeight

$outDir = Join-Path (Get-Location) "hls-out/$Slug"
if (-not (Test-Path -LiteralPath (Join-Path $outDir "master.m3u8"))) {
  Write-Error "master.m3u8 not found in $outDir - transcode did not complete."
}

# --- Step 2: upload ------------------------------------------------------
Write-Host ""
Write-Host "==> Uploading $outDir -> r2:flimix-videos/movies/$Slug" -ForegroundColor Cyan
& rclone copy $outDir "r2:flimix-videos/movies/$Slug" `
  --transfers 64 --checkers 16 `
  --s3-upload-concurrency 4 --s3-chunk-size 64M `
  --progress
if ($LASTEXITCODE -ne 0) { Write-Error "rclone upload failed (exit $LASTEXITCODE)." }

# --- Step 3: verify + cleanup -------------------------------------------
$remoteCount = (& rclone size "r2:flimix-videos/movies/$Slug" --json | ConvertFrom-Json).count
Write-Host "==> Uploaded objects: $remoteCount" -ForegroundColor Green

if (-not $KeepLocal) {
  Remove-Item -LiteralPath $outDir -Recurse -Force
  Write-Host "==> Removed local $outDir (use -KeepLocal to keep it)"
}

# --- Done: admin values ---------------------------------------------------
Write-Host ""
Write-Host "==> DONE. Enter these in the FLIMIX admin (Kino nemeh -> Video asset):" -ForegroundColor Yellow
Write-Host "  Provider          : Cloudflare R2 (r2)"
Write-Host "  Provider video ID : $Slug"
Write-Host "  HLS path          : /movies/$Slug/master.m3u8"
