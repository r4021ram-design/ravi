$word = New-Object -ComObject Word.Application
$word.Visible = $false
$docPath = "c:\Users\admin\Desktop\Market Learn and Research\Daily NSE Stock & Options Report App – Product Requirements Document.docx"
$doc = $word.Documents.Open($docPath)
$text = $doc.Content.Text
$text | Out-File -FilePath "c:\Users\admin\Desktop\Market Learn and Research\PRD_extracted.txt" -Encoding UTF8
$doc.Close($false)
$word.Quit()
Write-Host "Done extracting"
