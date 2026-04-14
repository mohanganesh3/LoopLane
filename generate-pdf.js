#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

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
        throw new Error('No markdown source found. Pass a file path: node generate-pdf.js <path-to-markdown>');
    }

    return discoveredPath;
};

// Read the markdown file
const markdownPath = resolveMarkdownPath();
const markdown = fs.readFileSync(markdownPath, 'utf-8');

// Convert markdown to HTML
const content = marked.parse(markdown);

// Create HTML with professional styling
const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LoopLane - Technical Documentation | Group 39</title>
    <style>
        @page {
            size: A4;
            margin: 1in 0.75in;
            
            @top-left {
                content: "LoopLane Documentation";
                font-family: Arial, sans-serif;
                font-size: 10pt;
                color: #666;
            }
            
            @top-right {
                content: "Group 39";
                font-family: Arial, sans-serif;
                font-size: 10pt;
                color: #666;
            }
            
            @bottom-center {
                content: counter(page);
                font-family: Arial, sans-serif;
                font-size: 10pt;
                color: #666;
            }
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Georgia', 'Times New Roman', serif;
            font-size: 11pt;
            line-height: 1.6;
            color: #333;
            background: white;
            max-width: 100%;
            margin: 0;
            padding: 0;
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
            padding: 2in;
        }
        
        .cover-page h1 {
            font-size: 48pt;
            margin-bottom: 0.5in;
            font-weight: bold;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        
        .cover-page .subtitle {
            font-size: 24pt;
            margin-bottom: 1in;
            font-weight: 300;
        }
        
        .cover-page .group-info {
            font-size: 18pt;
            line-height: 2;
            margin-top: 1in;
        }
        
        .cover-page .date {
            font-size: 14pt;
            margin-top: 0.5in;
            opacity: 0.9;
        }
        
        /* Table of Contents */
        .toc {
            page-break-after: always;
            padding: 1in 0;
        }
        
        .toc h1 {
            font-size: 32pt;
            margin-bottom: 0.5in;
            color: #667eea;
            border-bottom: 3px solid #667eea;
            padding-bottom: 10px;
        }
        
        .toc ul {
            list-style: none;
            padding-left: 0;
        }
        
        .toc li {
            margin: 8px 0;
            font-size: 12pt;
        }
        
        .toc a {
            color: #333;
            text-decoration: none;
        }
        
        .toc a:hover {
            color: #667eea;
            text-decoration: underline;
        }
        
        /* Main Content */
        h1 {
            font-size: 28pt;
            color: #667eea;
            margin-top: 0.5in;
            margin-bottom: 0.25in;
            page-break-before: always;
            border-bottom: 2px solid #667eea;
            padding-bottom: 10px;
        }
        
        h2 {
            font-size: 22pt;
            color: #764ba2;
            margin-top: 0.4in;
            margin-bottom: 0.2in;
            page-break-after: avoid;
        }
        
        h3 {
            font-size: 16pt;
            color: #555;
            margin-top: 0.3in;
            margin-bottom: 0.15in;
            page-break-after: avoid;
        }
        
        h4 {
            font-size: 13pt;
            color: #666;
            margin-top: 0.2in;
            margin-bottom: 0.1in;
            font-weight: 600;
        }
        
        p {
            margin-bottom: 0.15in;
            text-align: justify;
        }
        
        /* Code Blocks */
        pre {
            background: #f5f5f5;
            border: 1px solid #ddd;
            border-left: 4px solid #667eea;
            padding: 15px;
            margin: 0.2in 0;
            overflow-x: auto;
            font-family: 'Courier New', monospace;
            font-size: 9pt;
            line-height: 1.4;
            page-break-inside: avoid;
        }
        
        code {
            font-family: 'Courier New', monospace;
            font-size: 10pt;
            background: #f5f5f5;
            padding: 2px 5px;
            border-radius: 3px;
        }
        
        pre code {
            background: transparent;
            padding: 0;
        }
        
        /* Tables */
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 0.2in 0;
            page-break-inside: avoid;
            font-size: 10pt;
        }
        
        table thead {
            background: #667eea;
            color: white;
        }
        
        table th,
        table td {
            border: 1px solid #ddd;
            padding: 10px;
            text-align: left;
        }
        
        table tbody tr:nth-child(even) {
            background: #f9f9f9;
        }
        
        table tbody tr:hover {
            background: #f0f0f0;
        }
        
        /* Lists */
        ul, ol {
            margin: 0.15in 0;
            padding-left: 0.3in;
        }
        
        li {
            margin: 5px 0;
        }
        
        /* Blockquotes */
        blockquote {
            border-left: 4px solid #667eea;
            padding-left: 15px;
            margin: 0.2in 0;
            font-style: italic;
            color: #555;
            background: #f9f9f9;
            padding: 15px;
        }
        
        /* Links */
        a {
            color: #667eea;
            text-decoration: none;
        }
        
        a:hover {
            text-decoration: underline;
        }
        
        /* Horizontal Rules */
        hr {
            border: none;
            border-top: 2px solid #ddd;
            margin: 0.3in 0;
        }
        
        /* Checkmarks and Special Characters */
        .checkmark {
            color: #28a745;
            font-weight: bold;
        }
        
        /* Page Breaks */
        .page-break {
            page-break-after: always;
        }
        
        /* Print Styles */
        @media print {
            body {
                font-size: 11pt;
            }
            
            h1 {
                page-break-before: always;
            }
            
            h2, h3, h4 {
                page-break-after: avoid;
            }
            
            pre, table, img {
                page-break-inside: avoid;
            }
            
            a {
                color: #667eea !important;
            }
        }
        
        /* Badges */
        .badge {
            display: inline-block;
            padding: 3px 8px;
            background: #667eea;
            color: white;
            border-radius: 3px;
            font-size: 9pt;
            font-weight: bold;
            margin: 0 3px;
        }
        
        .badge.success {
            background: #28a745;
        }
        
        .badge.warning {
            background: #ffc107;
            color: #333;
        }
        
        .badge.danger {
            background: #dc3545;
        }
        
        /* Footer */
        .footer {
            margin-top: 1in;
            padding-top: 0.2in;
            border-top: 1px solid #ddd;
            text-align: center;
            font-size: 10pt;
            color: #666;
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

// Save HTML file alongside the input markdown file
const htmlPath = markdownPath.replace(/\.md$/i, '.html');
fs.writeFileSync(htmlPath, html);

console.log('✅ HTML file generated successfully!');
console.log('📄 Location:', htmlPath);
console.log('\n📝 Next steps:');
console.log('   1. Open DOCUMENTATION.html in Chrome/Edge');
console.log('   2. Press Cmd+P (or Ctrl+P on Windows)');
console.log('   3. Select "Save as PDF"');
console.log('   4. Adjust margins if needed');
console.log('   5. Click "Save"');
console.log('\nOr install puppeteer for automated PDF generation:');
console.log('   npm install puppeteer');
console.log(`   node generate-pdf-puppeteer.js ${path.relative(process.cwd(), markdownPath)}`);
