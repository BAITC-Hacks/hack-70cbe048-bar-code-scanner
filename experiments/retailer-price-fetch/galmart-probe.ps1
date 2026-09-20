param([string]$OutputPath = "$PSScriptRoot/galmart-results.json", [string[]]$Ean = @('4870207314301','4607037122598','4870091000663','4870091000724','4870091000847','4870001159955','4870001157906','4870001570071','4870002329487','4870002321276','4870055002696','4870055000852'))
$ErrorActionPreference = 'Stop'
$records = [System.Collections.Generic.List[object]]::new()
function Probe([string]$Path, [string]$City='2', [string]$Case='catalog') {
    $url = 'https://galmart.kz' + $Path
    $at = [DateTimeOffset]::UtcNow.ToString('o')
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $url -Headers @{City=$City; 'Accept-Language'='ru'} -TimeoutSec 25
        $json = $response.Content | ConvertFrom-Json
        $items = @($json.data | ForEach-Object {
            $_ | Select-Object id,articul,title,price,old_price,unit,unit_value,unit_price,old_unit_price,currency,available,inventory,country_name,brand_name,pack_name,cashback
        })
        $records.Add([PSCustomObject]@{case=$Case;url=$url;headers=@{City=$City;'Accept-Language'='ru'};retrieved_at=$at;http_status=[int]$response.StatusCode;api_status=$json.status;source_updated_at=$null;items=$items})
    } catch {
        $records.Add([PSCustomObject]@{case=$Case;url=$url;city=$City;retrieved_at=$at;error=$_.Exception.Message})
    }
}
# API paths and City header are used by the public official website JS client.
# No credentials, account calls, anti-bot bypass, or order writes are used.
Probe '/api/v2/catalog/goods/?search=Coca&limit=5' '2' 'text_search'
foreach ($id in @(10925,10528,10529,10530,210601)) {
    Probe "/api/v2/catalog/goods/$id/" '2' 'astana_pass1'
    Probe "/api/v2/catalog/goods/$id/" '1' 'almaty'
}
foreach ($id in @(10925,10528,10529,10530,210601)) { Probe "/api/v2/catalog/goods/$id/" '2' 'astana_pass2' }
Probe '/api/v2/catalog/goods/9553/' '2' 'weighted_internal_article'
# Negative fixture, not a claimed real product barcode.
Probe '/api/v2/catalog/goods/?search=0000000000000&limit=5' '2' 'unknown_barcode_fixture'
Probe '/api/v2/catalog/goods/?search=4870071003233&limit=5' '2' 'candidate_ean_search'
foreach ($code in $Ean) {
    if ($code -notmatch '^\d{8,14}$') { throw "Invalid barcode argument: $code" }
    foreach ($pass in @(1,2)) { Probe "/api/v2/catalog/goods/?search=$code&limit=5" '2' "verified_ean_pass$pass" }
}
Probe '/api/v2/catalog/goods/?search=4870207314530&limit=5' '2' 'real_ean_no_match'
Probe '/api/v2/catalog/goods/?search=2857067&limit=5' '2' 'documented_weighted_internal_code'
$records | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $OutputPath -Encoding utf8
$records | Select-Object case,http_status,@{n='count';e={@($_.items).Count}},@{n='prices';e={($_.items.price -join ',')}} | Format-Table -AutoSize
