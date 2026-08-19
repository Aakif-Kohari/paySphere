/**
 * @fileoverview Contract PDF Generation Worker
 * @description Offloads heavy PDF rendering from the main thread using worker_threads.
 * Converts populated HTML text into a standardized PDF layout using pdfkit.
 * Issue: #984
 */
const { parentPort } = require('worker_threads');
const PDFDocument = require('pdfkit');

/**
 * Strips basic HTML tags and converts to plain text for PDF rendering.
 * In a production app, a library like `html-to-pdfmake` would be used for rich text,
 * but this provides a robust baseline for standard offer letters.
 * 
 * @param {string} html - The populated HTML string
 * @returns {string} Plain text with basic formatting newlines
 */
function htmlToPlainText(html) {
    return html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<[^>]+>/g, '') // Strip remaining tags
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .trim();
}

parentPort.on('message', async (msg) => {
    try {
        if (msg.type !== 'GENERATE_CONTRACT_PDF') return;

        const { populatedHtml, candidateName, companyName } = msg.payload;
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const buffers = [];

        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => {
            parentPort.postMessage({
                success: true,
                pdfData: Buffer.concat(buffers)
            });
        });

        // --- PDF Layout ---

        // Header / Company Branding
        doc.fontSize(20).font('Helvetica-Bold').fillColor('#2563EB').text(companyName || 'PaySphere', { align: 'right' });
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica').fillColor('#64748b').text('Confidential Offer of Employment', { align: 'right' });

        doc.moveDown(2);
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke('#e2e8f0');
        doc.moveDown(1);

        // Date and Candidate Info
        const today = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
        doc.fontSize(11).fillColor('#0f172a').text(`Date: ${today}`);
        doc.moveDown(0.5);
        doc.text(`To: ${candidateName}`);
        doc.moveDown(1.5);

        // Body Content
        const plainText = htmlToPlainText(populatedHtml);
        const paragraphs = plainText.split('\n\n');

        doc.fontSize(11).font('Helvetica').fillColor('#334155');

        for (const para of paragraphs) {
            if (para.trim()) {
                // Check if paragraph is a heading (simple heuristic: all caps or short)
                const isHeading = para === para.toUpperCase() && para.length < 60 && para.length > 3;

                if (isHeading) {
                    doc.moveDown(0.5);
                    doc.font('Helvetica-Bold').fontSize(13).fillColor('#0f172a').text(para);
                    doc.font('Helvetica').fontSize(11).fillColor('#334155');
                    doc.moveDown(0.5);
                } else {
                    doc.text(para, { align: 'justify', lineGap: 4 });
                    doc.moveDown(0.8);
                }
            }
        }

        // Signature Block
        doc.moveDown(3);
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke('#e2e8f0');
        doc.moveDown(1);

        doc.fontSize(10).font('Helvetica-Bold').fillColor('#0f172a').text('Acceptance of Offer');
        doc.moveDown(0.5);
        doc.font('Helvetica').fillColor('#334155').text('By signing below or clicking "Accept" on the digital portal, you acknowledge that you have read, understood, and agree to the terms of this employment offer.');

        doc.moveDown(2);

        // Candidate Signature Line
        doc.moveTo(50, doc.y).lineTo(250, doc.y).stroke('#0f172a');
        doc.moveDown(0.2);
        doc.fontSize(9).text('Candidate Signature / Digital Acceptance', 50, doc.y);

        // Date Line
        doc.moveTo(350, doc.y - 12).lineTo(550, doc.y - 12).stroke('#0f172a');
        doc.text('Date', 350, doc.y);

        doc.end();

    } catch (error) {
        parentPort.postMessage({ success: false, error: error.message });
    }
});
