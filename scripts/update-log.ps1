# PowerShell script to update the project log

param (
    [Parameter(Mandatory=$true)]
    [string]$EntryType,
    
    [Parameter(Mandatory=$true)]
    [string]$EntryTitle,
    
    [Parameter(Mandatory=$false)]
    [string]$EntryContent
)

# Get current date
$date = Get-Date -Format "yyyy-MM-dd"
$logFile = Join-Path -Path $PSScriptRoot -ChildPath "..\PROJECT_LOG.md"

# Check if the date section already exists
$content = Get-Content -Path $logFile -Raw
$dateHeader = "## $date"

if ($content -match [regex]::Escape($dateHeader)) {
    Write-Host "Date section already exists. Adding entry under existing date." -ForegroundColor Cyan
    
    # Prepare the new entry
    $newEntry = "`n### $EntryTitle`n`n"
    if ($EntryContent) {
        # Replace \n with actual newlines
    $formattedContent = $EntryContent -replace '\\n', "`n"
    $newEntry += "$formattedContent`n"
    }
    
    # Insert the new entry after the date header
    $updatedContent = $content -replace "($dateHeader\r?\n)", "`$1$newEntry"
    
    # Write the updated content back to the file
    Set-Content -Path $logFile -Value $updatedContent
} else {
    Write-Host "Creating new date section and adding entry." -ForegroundColor Cyan
    
    # Prepare the new date section and entry
    # Replace \n with actual newlines
    $formattedContent = $EntryContent -replace '\\n', "`n"
    $newSection = "`n## $date`n`n### $EntryTitle`n`n"
    if ($EntryContent) {
        $newSection += "$formattedContent`n"
    }
    
    # Find the position to insert the new section (after the last date section)
    $lastDateSectionMatch = [regex]::Matches($content, "## \d{4}-\d{2}-\d{2}")
    if ($lastDateSectionMatch.Count -gt 0) {
        $lastDateSection = $lastDateSectionMatch[$lastDateSectionMatch.Count - 1].Value
        $updatedContent = $content -replace "($lastDateSection.*?)(\r?\n## Tasks Backlog|\r?\n$)", "`$1$newSection`$2"
        Set-Content -Path $logFile -Value $updatedContent
    } else {
        # If no date sections found, add before Tasks Backlog
        $updatedContent = $content -replace "(\r?\n## Tasks Backlog)", "$newSection`$1"
        Set-Content -Path $logFile -Value $updatedContent
    }
}

Write-Host "Project log updated successfully!" -ForegroundColor Green
Write-Host "Added '$EntryTitle' under '$EntryType' for $date" -ForegroundColor Green