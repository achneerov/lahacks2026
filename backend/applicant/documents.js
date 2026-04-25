const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const { PDFParse } = require('pdf-parse');

const db = require('../db');
const { requireAuth } = require('../auth/jwt');

const router = express.Router();

const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads', 'applicant_documents');
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_KINDS = new Set(['transcript', 'letter_of_recommendation', 'other']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter(req, file, cb) {
    if (file.mimetype === 'application/pdf' || /\.pdf$/i.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('only_pdf'));
    }
  },
});

function requireApplicant(req, res, next) {
  if (!req.user || req.user.role !== 'Applicant') {
    return res.status(403).json({ error: 'applicant_only' });
  }
  next();
}

function userDir(userId) {
  return path.join(UPLOAD_ROOT, String(userId));
}

function publicShape(row) {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    filename: row.filename,
    byte_size: row.byte_size,
    has_text: row.text_content != null && row.text_content.length > 0,
    created_at: row.created_at,
  };
}

router.get('/', requireAuth, requireApplicant, (req, res) => {
  try {
    const rows = db
      .prepare(
        `SELECT id, kind, title, filename, byte_size, text_content, created_at
           FROM applicant_documents WHERE user_id = ? ORDER BY created_at DESC, id DESC`,
      )
      .all(req.user.id);
    return res.json({ documents: rows.map(publicShape) });
  } catch (e) {
    console.error('[applicant/documents GET]', e);
    return res.status(500).json({ error: 'server_error' });
  }
});

router.post(
  '/',
  requireAuth,
  requireApplicant,
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (!err) return next();
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'file_too_large', detail: `Max ${MAX_BYTES} bytes.` });
      }
      if (err.message === 'only_pdf') {
        return res.status(400).json({ error: 'only_pdf', detail: 'Only PDF files are accepted.' });
      }
      console.error('[applicant/documents POST] multer:', err);
      return res.status(400).json({ error: 'upload_failed' });
    });
  },
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'missing_file' });
    const kindRaw = typeof req.body?.kind === 'string' ? req.body.kind.trim() : '';
    const titleRaw = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    if (!ALLOWED_KINDS.has(kindRaw)) {
      return res.status(400).json({ error: 'invalid_kind', detail: `kind must be one of ${[...ALLOWED_KINDS].join(', ')}` });
    }
    const title = titleRaw === '' ? null : titleRaw.slice(0, 200);
    const filename = (req.file.originalname || 'document.pdf').slice(0, 255);

    let textContent = null;
    let parser = null;
    try {
      parser = new PDFParse({ data: req.file.buffer });
      const parsed = await parser.getText();
      textContent = typeof parsed.text === 'string' ? parsed.text.trim() : null;
      if (textContent && textContent.length > 200000) {
        textContent = textContent.slice(0, 200000);
      }
    } catch (e) {
      console.warn('[applicant/documents POST] pdf parse failed:', e.message);
    } finally {
      if (parser && typeof parser.destroy === 'function') {
        try { await parser.destroy(); } catch {}
      }
    }

    const dir = userDir(req.user.id);
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (e) {
      console.error('[applicant/documents POST] mkdir:', e);
      return res.status(500).json({ error: 'server_error' });
    }

    const storedName = `${crypto.randomUUID()}.pdf`;
    const filePath = path.join(dir, storedName);
    try {
      fs.writeFileSync(filePath, req.file.buffer);
    } catch (e) {
      console.error('[applicant/documents POST] write:', e);
      return res.status(500).json({ error: 'server_error' });
    }

    try {
      const info = db
        .prepare(
          `INSERT INTO applicant_documents (user_id, kind, title, filename, file_path, byte_size, text_content)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          req.user.id,
          kindRaw,
          title,
          filename,
          filePath,
          req.file.size,
          textContent,
        );
      const row = db
        .prepare(
          `SELECT id, kind, title, filename, byte_size, text_content, created_at
             FROM applicant_documents WHERE id = ?`,
        )
        .get(info.lastInsertRowid);
      return res.status(201).json({ document: publicShape(row) });
    } catch (e) {
      try { fs.unlinkSync(filePath); } catch {}
      console.error('[applicant/documents POST] insert:', e);
      return res.status(500).json({ error: 'server_error' });
    }
  },
);

router.get('/:id/file', requireAuth, requireApplicant, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'invalid_id' });
  const row = db
    .prepare(
      `SELECT id, filename, file_path FROM applicant_documents WHERE id = ? AND user_id = ?`,
    )
    .get(id, req.user.id);
  if (!row) return res.status(404).json({ error: 'not_found' });
  if (!fs.existsSync(row.file_path)) return res.status(410).json({ error: 'file_missing' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `inline; filename="${row.filename.replace(/"/g, '')}"`,
  );
  fs.createReadStream(row.file_path).pipe(res);
});

router.delete('/:id', requireAuth, requireApplicant, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'invalid_id' });
  try {
    const row = db
      .prepare(`SELECT file_path FROM applicant_documents WHERE id = ? AND user_id = ?`)
      .get(id, req.user.id);
    if (!row) return res.status(404).json({ error: 'not_found' });
    db.prepare(`DELETE FROM applicant_documents WHERE id = ? AND user_id = ?`).run(id, req.user.id);
    try { fs.unlinkSync(row.file_path); } catch {}
    return res.json({ ok: true });
  } catch (e) {
    console.error('[applicant/documents DELETE]', e);
    return res.status(500).json({ error: 'server_error' });
  }
});

module.exports = router;
