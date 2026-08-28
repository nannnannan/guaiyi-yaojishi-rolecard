# sync-skills.ps1
# 从 00-Shared 同步全部 25 个 skill (含 TavernWeave 20 个技能 + 4 个 tavern-cards 基础技能) 到：
#   1. .claude\skills          （项目级 Claude 技能目录，完整镜像）
#   2. .codexbridge\skills     （项目级 Codex 技能目录，完整镜像）
#   3. .dsh\skills             （项目级 DeepSeek Harness 技能目录，完整镜像）
#   4. %USERPROFILE%\.codex\skills （用户级 Codex 技能目录，覆盖式更新，
#                                   保留 node_modules / st-bridge-output 等运行时产物）
#
# 用法:  pwsh -File sync-skills.ps1 [-SkipUserCodex]
[CmdletBinding()]
param(
    [switch]$SkipUserCodex
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

# skill 清单：名称 -> 源路径（相对项目根，源均位于 00-Shared）
$skills = [ordered]@{
    # tavern-cards 工具组
    'tavern-cards'                      = '00-Shared\tavern-cards\tavern-cards'
    'tavern-ui'                         = '00-Shared\tavern-cards\tavern-ui'
    'tavern-design'                     = '00-Shared\tavern-cards\tavern-design'
    'event-chain-builder'               = '00-Shared\tavern-cards\event-chain-builder'
    'sillytavern-ai-bridge'             = '00-Shared\AI接入酒馆工具\skill-package\sillytavern-ai-bridge'
    
    # TavernWeave 全量 20 个技能组 (v1.3.0)
    'activate-tavernweave-soul'         = '00-Shared\SillyTavern参考资料\TavernWeave技能\skills\activate-tavernweave-soul'
    'code-quality-workflow'             = '00-Shared\SillyTavern参考资料\TavernWeave技能\skills\code-quality-workflow'
    'consult-tavernweave-library'       = '00-Shared\SillyTavern参考资料\TavernWeave技能\skills\consult-tavernweave-library'
    'orchestrate-project-blueprint'     = '00-Shared\SillyTavern参考资料\TavernWeave技能\skills\orchestrate-project-blueprint'
    'reflect-on-vibe-code-growth'       = '00-Shared\SillyTavern参考资料\TavernWeave技能\skills\reflect-on-vibe-code-growth'
    'rolecard-workshop-ops'             = '00-Shared\SillyTavern参考资料\TavernWeave技能\skills\rolecard-workshop-ops'
    'shadcn-tailwind-ui'                = '00-Shared\SillyTavern参考资料\TavernWeave技能\skills\shadcn-tailwind-ui'
    'sillytavern-api-reference'         = '00-Shared\SillyTavern参考资料\TavernWeave技能\skills\sillytavern-api-reference'
    'sillytavern-card-components'       = '00-Shared\SillyTavern参考资料\TavernWeave技能\skills\sillytavern-card-components'
    'sillytavern-card-pipeline'         = '00-Shared\SillyTavern参考资料\TavernWeave技能\skills\sillytavern-card-pipeline'
    'sillytavern-component-update'      = '00-Shared\SillyTavern参考资料\TavernWeave技能\skills\sillytavern-component-update'
    'sillytavern-database-rolecards'    = '00-Shared\SillyTavern参考资料\TavernWeave技能\skills\sillytavern-database-rolecards'
    'sillytavern-embedded-ui'           = '00-Shared\SillyTavern参考资料\TavernWeave技能\skills\sillytavern-embedded-ui'
    'sillytavern-extension-dev'         = '00-Shared\SillyTavern参考资料\TavernWeave技能\skills\sillytavern-extension-dev'
    'sillytavern-media-live2d-runtime'  = '00-Shared\SillyTavern参考资料\TavernWeave技能\skills\sillytavern-media-live2d-runtime'
    'sillytavern-render-regex-pipeline' = '00-Shared\SillyTavern参考资料\TavernWeave技能\skills\sillytavern-render-regex-pipeline'
    'sillytavern-rolecard-performance'  = '00-Shared\SillyTavern参考资料\TavernWeave技能\skills\sillytavern-rolecard-performance'
    'sillytavern-rolecard-security'     = '00-Shared\SillyTavern参考资料\TavernWeave技能\skills\sillytavern-rolecard-security'
    'sillytavern-runtime-debug'         = '00-Shared\SillyTavern参考资料\TavernWeave技能\skills\sillytavern-runtime-debug'
    'tavern-card-builder'               = '00-Shared\SillyTavern参考资料\TavernWeave技能\skills\tavern-card-builder'
}

function Get-RelPath {
    param([string]$Base, [string]$Full)
    return $Full.Substring((Resolve-Path $Base).Path.Length + 1)
}

# 校验全部源存在
foreach ($name in $skills.Keys) {
    $src = Join-Path $root $skills[$name]
    if (-not (Test-Path (Join-Path $src 'SKILL.md'))) {
        throw "源 skill 缺失 SKILL.md: $src"
    }
}

# 1) 项目级目标：完整镜像（先删后拷，保证与源字节级一致）
$mirrorTargets = @(
    (Join-Path $root '.claude\skills'),
    (Join-Path $root '.codexbridge\skills'),
    (Join-Path $root '.dsh\skills')
)
foreach ($tgt in $mirrorTargets) {
    New-Item -ItemType Directory -Force -Path $tgt | Out-Null
    foreach ($name in $skills.Keys) {
        $src = Join-Path $root $skills[$name]
        $dst = Join-Path $tgt $name
        if (Test-Path $dst) { Remove-Item $dst -Recurse -Force }
        Copy-Item $src $dst -Recurse -Force
        Write-Host ("MIRROR  {0}  ->  {1}" -f $name, $dst)
    }
}

# 2) 用户级 Codex skills：覆盖式更新，不删除目标多余内容
if (-not $SkipUserCodex) {
    $userCodex = Join-Path $env:USERPROFILE '.codex\skills'
    New-Item -ItemType Directory -Force -Path $userCodex | Out-Null
    foreach ($name in $skills.Keys) {
        $src = Join-Path $root $skills[$name]
        $dst = Join-Path $userCodex $name
        New-Item -ItemType Directory -Force -Path $dst | Out-Null
        Get-ChildItem $src -Recurse -File | ForEach-Object {
            $rel = Get-RelPath -Base $src -Full $_.FullName
            $targetFile = Join-Path $dst $rel
            New-Item -ItemType Directory -Force -Path (Split-Path $targetFile) | Out-Null
            Copy-Item $_.FullName $targetFile -Force
        }
        Write-Host ("UPDATE  {0}  ->  {1}" -f $name, $dst)
    }
}

Write-Host ""

# 3) 同步 agents 目录到各目标
$agentsSrc = Join-Path $root '00-Shared\tavern-cards\agents'
if (Test-Path $agentsSrc) {
    $agentTargets = @(
        (Join-Path $root '.claude\agents'),
        (Join-Path $root '.codexbridge\agents'),
        (Join-Path $root '.dsh\agents')
    )
    foreach ($atgt in $agentTargets) {
        New-Item -ItemType Directory -Force -Path $atgt | Out-Null
        Copy-Item "$agentsSrc\*" $atgt -Force
        Write-Host ("AGENTS  {0}  ->  {1}" -f $agentsSrc, $atgt)
    }
    if (-not $SkipUserCodex) {
        $userAgents = Join-Path $env:USERPROFILE '.codex\agents'
        New-Item -ItemType Directory -Force -Path $userAgents | Out-Null
        Copy-Item "$agentsSrc\*" $userAgents -Force
        Write-Host ("AGENTS  {0}  ->  {1}" -f $agentsSrc, $userAgents)
    }
}

Write-Host ("全部 {0} 个 skill 同步完成。" -f $skills.Count)
