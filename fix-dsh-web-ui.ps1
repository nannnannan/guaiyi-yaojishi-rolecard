# fix-dsh-web-ui.ps1
# Patch the installed dsh-web-ui plugin family so it works on this DSH core
# (0.1.0-rc.6 fork).
#
# Patch table:
#   1. @linxin666/dsh-pet  (replace)
#        conversation.input.selector.context -> conversation.composer.dock
#      (whale-girl dock: floating pet + summon button)
#   2. @linxin666/dsh-client-ui-git-graph  (replace)
#        conversation.input.selector.context -> conversation.composer.dock
#      (git branch chip in the composer dock band)
#   3. @linxin666/dsh-client-ui-skin-center  (insert-after)
#      Auto try-on of the host-active skin at page boot. Without this the
#      skin applied via the skin center never shows: this core does NOT
#      rebuild the client boot graph when ~/.dsh/cordis.patch.yml changes,
#      so the applied skin's module is never in the boot roster, and the
#      page reload after "apply" lands on the stock look.
#
# NOTE: dsh-remote-web-ui is intentionally NOT patched. Its `sidebar.remote`
# seat does not exist in this core, but its sidebar footer fallback
# (`sidebar.footer.action`, no-op workspace hooks) already renders the full
# remote-control entry; remapping the missing seat would crash the UI
# because RemoteEntry calls useWorkspaces() unconditionally.
#
# Re-run this after every dsh-web-ui update. Usage:
#   pwsh -File fix-dsh-web-ui.ps1          (apply patches)
#   pwsh -File fix-dsh-web-ui.ps1 -Restore (roll back all patches)
[CmdletBinding()]
param([switch]$Restore)

$ErrorActionPreference = 'Stop'

$profileRoot = Join-Path $env:USERPROFILE '.dsh\profiles\web\node_modules\@linxin666'
$backupDir   = Join-Path $env:USERPROFILE '.dsh\web-ui-patch-backups'

$skinBootPatch = @'
ctx.effect(() => {
    let dead = false;
    fetch("/api/skin-center/state").then((r) => r.json()).then((s) => {
        if (dead || !s || s.ok !== true || s.active === "none") return;
        const ids = new Set(bootEntryIds());
        const entry = SKIN_CENTER_ENTRIES.find((e) => e.id === s.active);
        if (!entry || ids.has(entry.package)) return;
        controller.tryOn(entry).catch(() => {});
    }).catch(() => {});
    return () => { dead = true; };
}, "ui-skin-center: boot active skin");
'@

$patches = @(
    @{
        Pkg   = 'dsh-pet'
        File  = 'lib\client.js'
        Kind  = 'replace'
        Old   = 'conversation.input.selector.context'
        New   = 'conversation.composer.dock'
        Marker = 'conversation.input.selector.context'
    },
    @{
        Pkg   = 'dsh-client-ui-git-graph'
        File  = 'lib\client.js'
        Kind  = 'replace'
        Old   = 'conversation.input.selector.context'
        New   = 'conversation.composer.dock'
        Marker = 'conversation.input.selector.context'
    },
    @{
        Pkg   = 'dsh-client-ui-skin-center'
        File  = 'lib\client.js'
        Kind  = 'insert-after'
        Anchor = 'const controller = new TryOnController();'
        Insert = $skinBootPatch
        Marker = 'ui-skin-center: boot active skin'
    }
)

New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

foreach ($p in $patches) {
    $target = Join-Path $profileRoot (Join-Path $p.Pkg $p.File)
    $backup = Join-Path $backupDir ($p.Pkg + '.client.js.orig.bak')

    if (-not (Test-Path $target)) {
        Write-Host ("SKIP    {0}: bundle not found" -f $p.Pkg)
        continue
    }

    if ($Restore) {
        if (Test-Path $backup) {
            Copy-Item $backup $target -Force
            Write-Host ("RESTORE {0}" -f $p.Pkg)
        } else {
            Write-Host ("NO-BAK  {0}: no backup at {1}" -f $p.Pkg, $backup)
        }
        continue
    }

    # First run: keep a pristine backup (never overwrite it later).
    if (-not (Test-Path $backup)) {
        $legacyPetBackup = Join-Path $env:USERPROFILE '.dsh\pet-client.js.orig.bak'
        if ($p.Pkg -eq 'dsh-pet' -and (Test-Path $legacyPetBackup)) {
            Copy-Item $legacyPetBackup $backup -Force
            Write-Host ("MIGRATE {0}: backup adopted from {1}" -f $p.Pkg, $legacyPetBackup)
        } else {
            Copy-Item $target $backup -Force
            Write-Host ("BACKUP  {0}: {1}" -f $p.Pkg, $backup)
        }
    }

    $text = [IO.File]::ReadAllText($target, [Text.UTF8Encoding]::new($false))

    if ($text.Contains($p.Marker) -and $p.Kind -eq 'insert-after') {
        Write-Host ("SKIP    {0}: already patched" -f $p.Pkg)
        continue
    }
    if ($p.Kind -eq 'replace') {
        $count = ([regex]::Matches($text, [regex]::Escape($p.Old))).Count
        if ($count -eq 0) {
            Write-Host ("SKIP    {0}: no occurrence (already patched or changed)" -f $p.Pkg)
            continue
        }
        $text = $text.Replace($p.Old, $p.New)
        Write-Host ("PATCH   {0}: {1} occurrence(s) {2} -> {3}" -f $p.Pkg, $count, $p.Old, $p.New)
    }
    if ($p.Kind -eq 'insert-after') {
        $anchorCount = ([regex]::Matches($text, [regex]::Escape($p.Anchor))).Count
        if ($anchorCount -ne 1) {
            Write-Host ("SKIP    {0}: anchor count {1} (expected 1), manual review needed" -f $p.Pkg, $anchorCount)
            continue
        }
        $idx = $text.IndexOf($p.Anchor) + $p.Anchor.Length
        $text = $text.Insert($idx, $p.Insert)
        Write-Host ("PATCH   {0}: inserted boot auto-try-on after anchor" -f $p.Pkg)
    }

    [IO.File]::WriteAllText($target, $text, [Text.UTF8Encoding]::new($false))
}

Write-Host 'Done. Hard-refresh the DSH Web GUI (Ctrl+F5) to load the patched bundles.'
