$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$outputRoot = Join-Path $projectRoot 'outputs'
$workExplorerRoot = Join-Path $outputRoot '업무탐색기'
$simpleRoot = Join-Path $workExplorerRoot '간이보기'
$fullRoot = Join-Path $workExplorerRoot '전체보기'
$sharedRoot = 'C:\Users\Administrator\CodexWork'
$workShell = New-Object -ComObject WScript.Shell
function Add-WorkLink([string]$directory,[string]$name,[string]$target,[string]$description) {
    if (-not (Test-Path -LiteralPath $target)) { throw "원본이 없습니다: $target" }
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
    $link = $workShell.CreateShortcut((Join-Path $directory ($name + '.lnk')))
    $link.TargetPath = $target
    $link.WorkingDirectory = if (Test-Path -LiteralPath $target -PathType Container) { $target } else { Split-Path $target -Parent }
    $link.Description = $description
    $link.Save()
}
$docs = Join-Path $simpleRoot '01 사용 설명서'
Add-WorkLink $docs 'Codex 사용 매뉴얼' (Join-Path $outputRoot 'Codex.html') '웹 형태 사용 설명서'
Add-WorkLink $docs 'Codex 텍스트 안내' (Join-Path $outputRoot 'Codex.txt') '메모장으로 읽는 파일 안내'
Add-WorkLink $docs '마루 사용 설명서' (Join-Path $sharedRoot 'chat-studio\README.md') '마루 실행·종료와 저장 안내'
$sites = Join-Path $simpleRoot '02 사이트'
New-Item -ItemType Directory -Path $sites -Force | Out-Null
@(
    @('취향의 조각','https://taste-pieces-nov03.bestsmileman.chatgpt.site'),
    @('Studio Note 포트폴리오','https://studio-note-nov03.bestsmileman.chatgpt.site'),
    @('오늘의 몰입','https://day-focus-nov03.bestsmileman.chatgpt.site')
) | ForEach-Object { [IO.File]::WriteAllText((Join-Path $sites ($_[0]+'.url')), "[InternetShortcut]`r`nURL=$($_[1])`r`n", [Text.Encoding]::ASCII) }
$launch = Join-Path $simpleRoot '03 시작과 종료'
Add-WorkLink $launch 'Codex 매뉴얼 시작' (Join-Path $outputRoot 'Start-Codex.cmd') '웹 매뉴얼 서버 시작 및 화면 열기'
Add-WorkLink $launch 'Codex 매뉴얼 종료' (Join-Path $outputRoot 'Stop-Codex.cmd') '웹 매뉴얼 서버만 종료'
Add-WorkLink $launch '마루 시작' (Join-Path $sharedRoot 'chat-studio\start-maru.cmd') '마루 화면 열기'
Add-WorkLink $launch '마루 종료' (Join-Path $sharedRoot 'chat-studio\stop-maru.cmd') '작업 완료 후 마루 종료'
Add-WorkLink $fullRoot '01 공통 작업 폴더' $sharedRoot '공통 작업과 기록 전체'
Add-WorkLink $fullRoot '02 협업 기록' (Join-Path $sharedRoot 'memory') '인계·제작 기준·이야기 기록'
Add-WorkLink $fullRoot '03 마루 원본' (Join-Path $sharedRoot 'chat-studio') '마루 프로그램 전체'
Add-WorkLink $fullRoot '04 사이트 작업 원본' (Join-Path $projectRoot 'work') '세 사이트의 제작 원본과 검사 도구'
Add-WorkLink $fullRoot '05 매뉴얼과 결과물' $outputRoot '매뉴얼·실행 파일·게시 묶음'
foreach ($viewRoot in @($simpleRoot,$fullRoot)) {
    $desktopIni = Join-Path $viewRoot 'desktop.ini'
    if (Test-Path -LiteralPath $desktopIni) { (Get-Item -LiteralPath $desktopIni -Force).Attributes = 'Normal' }
    [IO.File]::WriteAllText($desktopIni, "[.ShellClassInfo]`r`nInfoTip=Codex 업무별 모음 - 원본은 기존 위치에 있습니다.`r`n", [Text.Encoding]::Unicode)
    (Get-Item -LiteralPath $desktopIni -Force).Attributes = 'Hidden, System'
    (Get-Item -LiteralPath $viewRoot).Attributes = 'ReadOnly, Directory'
}
$created = Get-ChildItem -LiteralPath $workExplorerRoot -Recurse -Filter '*.lnk'
foreach ($item in $created) {
    $link = $workShell.CreateShortcut($item.FullName)
    if (-not (Test-Path -LiteralPath $link.TargetPath)) { throw "바로가기 대상 없음: $($item.Name)" }
}
Write-Output "Verified $($created.Count) file/folder shortcuts and 3 website shortcuts."
