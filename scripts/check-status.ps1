# PowerShell script to check the status of the Docker container

Write-Host "Checking Docker container status..." -ForegroundColor Cyan

# Check if Docker is running
try {
    $dockerStatus = docker info 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Docker is not running. Please start Docker Desktop." -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "Error checking Docker status: $_" -ForegroundColor Red
    exit 1
}

Write-Host "Docker is running." -ForegroundColor Green

# Check if the container is running
try {
    $containerStatus = docker-compose ps --services --filter "status=running" 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error checking container status: $containerStatus" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "Error checking container status: $_" -ForegroundColor Red
    exit 1
}

if ($containerStatus -match "app") {
    Write-Host "Container is running." -ForegroundColor Green
    
    # Get container details
    $containerDetails = docker-compose ps
    Write-Host "`nContainer Details:" -ForegroundColor Cyan
    Write-Host $containerDetails
    
    Write-Host "`nAccess the admin interface at: http://127.0.0.1:81" -ForegroundColor Yellow
} else {
    Write-Host "Container is not running." -ForegroundColor Red
    Write-Host "Start the container with: docker-compose up -d" -ForegroundColor Yellow
}