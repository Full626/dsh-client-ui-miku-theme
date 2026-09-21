<#
.SYNOPSIS
    把 dsh-client-ui-miku-theme 安装到（或从）一个 dsh profile 卸载。

.DESCRIPTION
    包装 scripts/install.mjs：复制插件包到 <profile>/node_modules，并在
    <profile>/cordis.patch.yml 里插入一条带标记的加载行（可重复执行）。

.PARAMETER DshHome
    dsh 数据目录。省略时使用 $env:DSH_HOME。

.PARAMETER Profile
    profile 名字，默认 web。

.PARAMETER Uninstall
    移除加载行与插件目录。

.PARAMETER DryRun
    只打印将要写入的 cordis.patch.yml，不改动任何文件。

.EXAMPLE
    .\install.ps1 -DshHome 'D:\AgentData\dsh_data'
#>
[CmdletBinding()]
param(
    [string]$DshHome = $env:DSH_HOME,
    [string]$Profile = 'web',
    [switch]$Uninstall,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

$scriptPath = Join-Path $PSScriptRoot 'scripts\install.mjs'
if (-not (Test-Path -LiteralPath $scriptPath)) {
    throw "找不到安装脚本: $scriptPath"
}

$nodeArgs = @($scriptPath, '--profile', $Profile)
if ($DshHome) { $nodeArgs += @('--dsh-home', $DshHome) }
if ($Uninstall) { $nodeArgs += '--uninstall' }
if ($DryRun) { $nodeArgs += '--dry-run' }

& node @nodeArgs
exit $LASTEXITCODE
