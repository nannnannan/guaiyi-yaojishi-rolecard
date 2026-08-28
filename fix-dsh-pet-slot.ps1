# fix-dsh-pet-slot.ps1
# Patch the installed @linxin666/dsh-pet browser bundle so the whale-girl
# mounts into `conversation.composer.dock` instead of the missing
# `conversation.input.selector.context` slot (not provided by this DSH core).
# Re-run this after every dsh-web-ui / dsh-pet update.
#
# Usage:  pwsh -File fix-dsh-pet-slot.ps1 [-Restore]
[CmdletBinding()]
param([switch]$Restore)

$ErrorActionPreference = 'Stop'

$petClient = Join-Path $env:USERPROFILE '.dsh\profiles\web\node_modules\@linxin666\dsh-pet\lib\client.js'
$backup    = Join-Path $env:USERPROFILE '.dsh\pet-client.js.orig.bak'

if (-not (Test-Path $petClient)) {
    throw "dsh-pet client bundle not found: $petClient"
}

$old = 'conversation.input.selector.context'
$new = 'conversation.composer.dock'

if ($Restore) {
    if (-not (Test-Path $backup)) { throw "No backup at $backup" }
    Copy-Item $backup $petClient -Force
    Write-Host 'Restored original pet client.js from backup.'
    return
}

# First run: keep a pristine backup (never overwrite it later).
if (-not (Test-Path $backup)) {
    Copy-Item $petClient $backup -Force
    Write-Host "Backup saved: $backup"
}

$text = [IO.File]::ReadAllText($petClient, [Text.UTF8Encoding]::new($false))
$count = ([regex]::Matches($text, [regex]::Escape($old))).Count
if ($count -eq 0) {
    Write-Host 'No slot string found (already patched or file changed). Nothing to do.'
    return
}

$text = $text.Replace($old, $new)
[IO.File]::WriteAllText($petClient, $text, [Text.UTF8Encoding]::new($false))

Write-Host ("Patched {0} occurrence(s): {1} -> {2}" -f $count, $old, $new)
Write-Host 'Hard-refresh the DSH Web GUI (Ctrl+F5). The whale-girl now docks at conversation.composer.dock.'
