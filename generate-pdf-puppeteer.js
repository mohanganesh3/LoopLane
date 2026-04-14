#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const puppeteer = require('puppeteer');

const DEFAULT_MARKDOWN_CANDIDATES = [
    path.join(__dirname, 'midreview_submission', 'DOCUMENTATION.md'),
    path.join(__dirname, 'PROJECT_DESCRIPTION.md'),
    path.join(__dirname, 'README.md')
];

const resolveMarkdownPath = () => {
    const providedPath = process.argv[2];
    if (providedPath) {
        const absolutePath = path.resolve(process.cwd(), providedPath);
        if (!fs.existsSync(absolutePath)) {
            throw new Error(`Markdown file not found: ${absolutePath}`);
        }
        return absolutePath;
    }

    const discoveredPath = DEFAULT_MARKDOWN_CANDIDATES.find((candidate) => fs.existsSync(candidate));
    if (!discoveredPath) {
        throw new Error('No markdown source found. Pass a file path: node generate-pdf-puppeteer.js <path-to-markdown>');
    }

    return discoveredPath;
};

async function generatePDF() {
    console.log('🚀 Starting PDF generation...\n');

    // Read the markdown file
    const markdownPath = resolveMarkdownPath();
    const markdown = fs.readFileSync(markdownPath, 'utf-8');

    console.log('✅ Markdown file loaded');

    // Convert markdown to HTML
    const content = marked.parse(markdown);

    console.log('✅ Markdown converted to HTML');

    // Create HTML with professional styling
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LoopLane - Technical Documentation | Group 39</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Helvetica', 'Arial', sans-serif;
            font-size: 11pt;
            line-height: 1.6;
            color: #333;
            background: white;
            padding: 40px 60px;
        }
        
        /* Cover Page */
        .cover-page {
            page-break-after: always;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            text-align: center;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 100px 60px;
            margin: -40px -60px 0 -60px;
        }
        
        .cover-page h1 {
            font-size: 56pt;
            margin-bottom: 30px;
            font-weight: bold;
            text-shadow: 2px 2px 8px rgba(0,0,0,0.3);
        }
        
        .cover-page .subtitle {
            font-size: 28pt;
            margin-bottom: 80px;
            font-weight: 300;
        }
        
        .cover-page .group-info {
            font-size: 18pt;
            line-height: 2;
            margin-top: 80px;
        }
        
        .cover-page .date {
            font-size: 16pt;
            margin-top: 40px;
            opacity: 0.95;
        }
        
        /* Headings */
        h1 {
            font-size: 32pt;
            color: #667eea;
            margin-top: 50px;
            margin-bottom: 20px;
            page-break-before: always;
            border-bottom: 3px solid #667eea;
            padding-bottom: 10px;
            padding-top: 20px;
        }
        
        h1:first-of-type {
            page-break-before: avoid;
        }
        
        h2 {
            font-size: 24pt;
            color: #764ba2;
            margin-top: 40px;
            margin-bottom: 15px;
            page-break-after: avoid;
        }
        
        h3 {
            font-size: 18pt;
            color: #555;
            margin-top: 30px;
            margin-bottom: 12px;
            page-break-after: avoid;
        }
        
        h4 {
            font-size: 14pt;
            color: #666;
            margin-top: 20px;
            margin-bottom: 10px;
            font-weight: 600;
        }
        
        p {
            margin-bottom: 12px;
            text-align: justify;
        }
        
        /* Code Blocks */
        pre {
            background: #f8f9fa;
            border: 1px solid #e0e0e0;
            border-left: 4px solid #667eea;
            padding: 16px;
            margin: 20px 0;
            overflow-x: auto;
            font-family: 'Monaco', 'Courier New', monospace;
            font-size: 9pt;
            line-height: 1.5;
            page-break-inside: avoid;
            border-radius: 4px;
        }
        
        code {
            font-family: 'Monaco', 'Courier New', monospace;
            font-size: 10pt;
            background: #f0f0f0;
            padding: 2px 6px;
            border-radius: 3px;
            color: #d63384;
        }
        
        pre code {
            background: transparent;
            padding: 0;
            color: #333;
        }
        
        /* Tables */
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            page-break-inside: avoid;
            font-size: 10pt;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        table thead {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        
        table th,
        table td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
        }
        
        table th {
            font-weight: 600;
            text-transform: uppercase;
            font-size: 9pt;
            letter-spacing: 0.5px;
        }
        
        table tbody tr:nth-child(even) {
            background: #f9f9f9;
        }
        
        table tbody tr:hover {
            background: #f0f4ff;
        }
        
        /* Lists */
        ul, ol {
            margin: 15px 0;
            padding-left: 30px;
        }
        
        li {
            margin: 6px 0;
        }
        
        /* Blockquotes */
        blockquote {
            border-left: 4px solid #667eea;
            padding-left: 20px;
            margin: 20px 0;
            font-style: italic;
            color: #555;
            background: #f9f9f9;
            padding: 20px;
            border-radius: 4px;
        }
        
        /* Links */
        a {
            color: #667eea;
            text-decoration: none;
            font-weight: 500;
        }
        
        a:hover {
            text-decoration: underline;
        }
        
        /* Horizontal Rules */
        hr {
            border: none;
            border-top: 2px solid #e0e0e0;
            margin: 30px 0;
        }
        
        /* Emoji and Icons */
        .emoji {
            font-size: 1.2em;
        }
        
        /* Strong and Emphasis */
        strong {
            color: #667eea;
            font-weight: 600;
        }
        
        em {
            color: #764ba2;
        }
        
        /* Page Breaks */
        .page-break {
            page-break-after: always;
        }
        
        /* Print Optimizations */
        @media print {
            body {
                padding: 0;
            }
            
            h1, h2, h3, h4 {
                page-break-after: avoid;
            }
            
            pre, table, img, blockquote {
                page-break-inside: avoid;
            }
        }
        
        /* Content wrapper */
        .content {
            max-width: 100%;
        }
        
        /* Footer */
        .footer {
            margin-top: 60px;
            padding-top: 20px;
            border-top: 2px solid #e0e0e0;
            text-align: center;
            font-size: 10pt;
            color: #666;
            page-break-before: avoid;
        }
    </style>
</head>
<body>
    <!-- Cover Page -->
    <div class="cover-page">
        <h1>🚗 LoopLane</h1>
        <div class="subtitle">Advanced Carpooling Platform</div>
        <div class="subtitle">Complete Technical Documentation</div>
        <div class="group-info">
            <strong>Group 39 | Mid-Review Submission</strong><br>
            Team Lead: Mohan Ganesh (S20230010092)<br>
            Team Members: Karthik, Dinesh, Akshaya, Sujal
        </div>
        <div class="date">October 13, 2025</div>
    </div>
    
    <!-- Main Content -->
    <div class="content">
        ${content}
    </div>
    
    <!-- Footer -->
    <div class="footer">
        © 2025 LoopLane - Group 39. All rights reserved.<br>
        Repository: https://github.com/mohanganesh3/CreaPrompt_Studio
    </div>
</body>
</html>
`;

    // Launch browser
    console.log('🌐 Launching browser...');
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    
    console.log('✅ Browser launched');

    // Set content
    await page.setContent(html, {
        waitUntil: 'networkidle0'
    });

    console.log('✅ Content loaded');

    // Generate PDF
    const pdfPath = markdownPath.replace(/\.md$/i, '.pdf');
    
    await page.pdf({
        path: pdfPath,
        format: 'A4',
        margin: {
            top: '0.75in',
            right: '0.75in',
            bottom: '0.75in',
            left: '0.75in'
        },
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: `
            <div style="font-size: 9pt; color: #666; width: 100%; padding: 0 40px; display: flex; justify-content: space-between;">
                <span>LoopLane Documentation</span>
                <span>Group 39</span>
            </div>
        `,
        footerTemplate: `
            <div style="font-size: 9pt; color: #666; width: 100%; text-align: center;">
                <span class="pageNumber"></span> / <span class="totalPages"></span>
            </div>
        `
    });

    console.log('✅ PDF generated');

    await browser.close();

    console.log('\n🎉 PDF generation completed successfully!');
    console.log('📄 Location:', pdfPath);
    console.log('📊 File size:', (fs.statSync(pdfPath).size / 1024 / 1024).toFixed(2), 'MB');
    console.log('\n✨ Your professional PDF documentation is ready!');
}

// Run the function
generatePDF().catch(error => {
    console.error('❌ Error generating PDF:', error);
    process.exit(1);
});
