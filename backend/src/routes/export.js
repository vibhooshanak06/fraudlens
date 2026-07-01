'use strict';
const express     = require('express');
const router      = express.Router();
const PDFDocument = require('pdfkit');
const pool        = require('../mysql');
const Paper       = require('../models/Paper');
const { requireAuth } = require('../middleware/auth');

/* ─── Page geometry ─────────────────────────────────────────────────── */
const PW = 595.28, PH = 841.89;   // A4 pts
const M  = 38;                     // margin
const CW = PW - M * 2;            // 519 pt content width

/* ─── Palette ───────────────────────────────────────────────────────── */
const C = {
  bg:'#07111f', surface:'#0f1c30', alt:'#162236', border:'#1d2f4a',
  accent:'#4f8ef7', dimAcc:'#1b3461',
  muted:'#6b84a8', soft:'#9fb4d0', text:'#d8e8ff',
  low:'#10b981', lowBg:'#04211a',
  med:'#f59e0b', medBg:'#221700',
  hi:'#ef4444',  hiBg:'#220505',
};
const riskC  = l => ({low:C.low,medium:C.med,high:C.hi,critical:C.hi }[(l||'').toLowerCase()])||C.muted;
const riskBg = l => ({low:C.lowBg,medium:C.medBg,high:C.hiBg,critical:C.hiBg}[(l||'').toLowerCase()])||C.alt;

/* ─── Drawing primitives ────────────────────────────────────────────── */
const fillR  = (d,x,y,w,h,f)      => d.save().rect(x,y,w,h).fill(f).restore();
const rrect  = (d,x,y,w,h,r,f,s)  => { d.save().roundedRect(x,y,w,h,r); s?d.fillAndStroke(f,s):d.fill(f); d.restore(); };
const hline  = (d,x1,y,x2,c,lw)   => d.save().moveTo(x1,y).lineTo(x2,y).strokeColor(c).lineWidth(lw||0.5).stroke().restore();

/* score bar */
const scorebar = (d,x,y,w,h,pct,c) => {
  rrect(d,x,y,w,h,h/2,C.alt,C.border);
  if(pct>0) rrect(d,x,y,Math.max(w*Math.min(pct,1),h),h,h/2,c);
};

/* single-line text — NEVER wraps, never overflows page */
const txt = (d,s,x,y,opts) =>
  d.fontSize(opts.size||8).font(opts.bold?'Helvetica-Bold':'Helvetica')
   .fillColor(opts.color||C.soft)
   .text(String(s??'—'), x, y, { width:opts.w||CW, lineBreak:false,
     align:opts.align||'left', characterSpacing:opts.cs||0 });

/* multi-line text capped at maxLines lines */
const mtxt = (d,s,x,y,w,size,color,maxLines) => {
  if(!s) return y;
  const lineH = size * 1.45;
  const cap   = maxLines ? maxLines * lineH : 9999;
  d.fontSize(size).font('Helvetica').fillColor(color)
   .text(String(s), x, y, { width:w, lineGap:size*0.45,
     height:cap, ellipsis:true });
  return d.y;
};

/* small badge pill */
const pill = (d,text,x,y,bg,fg) => {
  d.fontSize(6.5).font('Helvetica-Bold');
  const tw = d.widthOfString(text), pw = tw+10, ph = 12;
  d.save().roundedRect(x,y,pw,ph,2).fill(bg).restore();
  d.fillColor(fg).text(text, x+5, y+3, {width:tw,lineBreak:false});
  return pw+4;
};

/* section heading bar — returns new y */
const secHead = (d,label,y) => {
  fillR(d, M, y, 3, 11, C.accent);
  txt(d, label, M+8, y+1, {size:9,bold:true,color:C.text,w:CW-8});
  hline(d, M, y+16, PW-M, C.border, 0.4);
  return y+22;
};

const trunc = (s,n) => { s=String(s||''); return s.length<=n?s:s.slice(0,n-1)+'…'; };

/* ═══════════════════════════════════════════════════════════════════════
   PAGE 1  (y: 0 → 841)
   Header 54 | Paper block 44 | Section head 22 | Metric cards 52 |
   Score bar 26 | Issues section head 22 | Issues rows (5×40=200) |
   Footer 28  → total ≈ 448 + dynamic issues. Hard-caps at PH.
═══════════════════════════════════════════════════════════════════════ */
function page1(doc, meta, fraud_report) {
  fillR(doc, 0, 0, PW, PH, C.bg);

  /* Header */
  fillR(doc, 0, 0, PW, 52, C.surface);
  fillR(doc, 0, 0, 4,  52, C.accent);
  hline(doc, 0, 52, PW, C.border, 0.6);
  txt(doc,'FraudLens', M+8, 13, {size:16,bold:true,color:C.accent});
  txt(doc,'Research Integrity Analysis Report', M+8, 34, {size:8,color:C.muted});
  const dateStr = new Date().toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'});
  txt(doc, dateStr, M, 19, {size:7.5,color:C.muted,align:'right'});

  /* Paper info block */
  let y = 62;
  rrect(doc, M, y, CW, 38, 4, C.surface, C.border);
  txt(doc,'DOCUMENT', M+12, y+6,  {size:6.5,bold:true,color:C.muted,cs:0.5});
  txt(doc, trunc(meta.filename,75), M+12, y+18, {size:8.5,bold:true,color:C.text, w:CW*0.6});
  const upDate = new Date(meta.uploaded_at).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'});
  txt(doc,`Uploaded: ${upDate}`, M, y+8,  {size:7,color:C.muted,align:'right'});
  const stBg = meta.status==='completed'?C.lowBg:C.alt;
  const stFg = meta.status==='completed'?C.low  :C.soft;
  pill(doc,(meta.status||'unknown').toUpperCase(), PW-M-52, y+22, stBg, stFg);

  y = 110;

  /* Fraud section */
  y = secHead(doc,'Fraud & Integrity Analysis', y);

  if (!fraud_report) {
    txt(doc,'Analysis data unavailable.',M,y,{size:8,color:C.muted});
    return;
  }

  const pct    = Math.round((fraud_report.plagiarism_score||0)*100);
  const rc     = riskC(fraud_report.risk_level);
  const rbg    = riskBg(fraud_report.risk_level);
  const issues = fraud_report.issues||[];
  const lvl    = (fraud_report.risk_level||'UNKNOWN').toUpperCase();

  /* 3 metric cards */
  const cw = (CW-16)/3, ch = 50;
  [ [`${pct}%`,'PLAGIARISM SCORE',rc],
    [issues.length,'ISSUES DETECTED', issues.length?C.med:C.low],
    [lvl,'RISK LEVEL',rc]
  ].forEach(([val,lbl,col],i)=>{
    const cx = M + i*(cw+8);
    rrect(doc, cx, y, cw, ch, 5, rbg, rc);
    txt(doc, String(val), cx, y+8,  {size:16,bold:true,color:col,w:cw,align:'center'});
    txt(doc, lbl,         cx, y+30, {size:6,color:C.muted,w:cw,align:'center',cs:0.3});
  });
  y += ch+10;

  /* Score bar */
  txt(doc,'Plagiarism Score', M, y, {size:7,color:C.muted});
  txt(doc,`${pct}%`, M, y, {size:7,bold:true,color:rc,align:'right'});
  scorebar(doc, M, y+12, CW, 7, pct/100, rc);
  y += 26;

  /* Issues */
  y = secHead(doc,'Detected Issues', y);

  if(issues.length===0){
    rrect(doc,M,y,CW,26,4,C.lowBg,C.low);
    txt(doc,'✓  No issues detected — paper passed all integrity checks.',
      M+12,y+8,{size:8,bold:true,color:C.low,w:CW-24});
    return;
  }

  /* Max 5 issues, each exactly 38 pt tall */
  const ROW = 38, maxShow = 5;
  issues.slice(0,maxShow).forEach((iss,i)=>{
    const ry   = y + i*(ROW+4);
    if(ry+ROW > PH-36) return;           // safety: never draw past footer
    const lbl  = (iss.type||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
    const desc = trunc(iss.description||'',140);
    const sev  = (iss.severity||'').toLowerCase();
    const sc   = sev.includes('high')||sev.includes('critical')?C.hi
               : sev.includes('med')||sev.includes('moderate') ?C.med:C.low;

    rrect(doc, M, ry, CW, ROW, 4, C.surface, C.border);
    doc.save().circle(M+14, ry+ROW/2, 8).fill(C.dimAcc).restore();
    txt(doc,`${i+1}`, M+10, ry+ROW/2-5, {size:7.5,bold:true,color:C.accent,w:8,align:'center'});
    pill(doc,(iss.severity||'INFO').toUpperCase(), PW-M-46, ry+8, C.alt, sc);
    txt(doc, lbl,  M+30, ry+6,  {size:8.5,bold:true,color:C.text, w:CW-84});
    txt(doc, desc, M+30, ry+20, {size:7.5,color:C.soft,           w:CW-84});
  });

  if(issues.length>maxShow){
    const ny = y + maxShow*(ROW+4) + 4;
    if(ny < PH-36)
      txt(doc,`+ ${issues.length-maxShow} more issue(s) — view full detail in the app.`,
        M, ny, {size:7,color:C.muted});
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   PAGE 2  — AI Summary + Keywords + Disclaimer
   All positioned absolutely. Text capped so nothing overflows.
═══════════════════════════════════════════════════════════════════════ */
function page2(doc, summary, keywords) {
  doc.addPage();
  fillR(doc, 0, 0, PW, PH, C.bg);

  /* Thin header strip */
  fillR(doc, 0, 0, PW, 4, C.accent);
  fillR(doc, 0, 4, PW, 32, C.surface);
  hline(doc, 0, 36, PW, C.border, 0.5);
  txt(doc,'AI-GENERATED ANALYSIS SUMMARY', M+8, 14,
    {size:8,bold:true,color:C.muted,cs:0.5});

  let y = 46;
  const BOTTOM = PH - 80;   // leave 80 pt for keywords + disclaimer + footer

  if (summary) {
    const fields = [
      { key:'title',              label:'Title',              maxCh:180, maxLines:2  },
      { key:'main_contributions', label:'Main Contributions', maxCh:380, maxLines:5  },
      { key:'methodology',        label:'Methodology',        maxCh:380, maxLines:5  },
      { key:'conclusions',        label:'Conclusions',        maxCh:380, maxLines:5  },
    ];

    for (const f of fields) {
      if (!summary[f.key]) continue;
      if (y >= BOTTOM - 30)  break;     // no space left — stop

      y = secHead(doc, f.label, y);
      const val = trunc(summary[f.key], f.maxCh);

      /* measure how tall the text block will be */
      const lineH  = 8.5 * 1.45;
      const estH   = Math.min(f.maxLines * lineH, 9999) + 16;
      const boxH   = Math.min(estH, BOTTOM - y - 8);

      if (boxH < 22) break;            // too small to be useful

      rrect(doc, M, y, CW, boxH, 4, C.alt, C.border);
      /* cap text to the box height */
      doc.fontSize(8.5).font('Helvetica').fillColor(C.soft)
         .text(val, M+10, y+9,
           { width: CW-20, height: boxH-16, lineGap:3, ellipsis:true });
      y += boxH + 10;
    }
  } else {
    y = secHead(doc,'Summary', y);
    txt(doc,'No AI summary available for this paper.', M, y, {size:8,color:C.muted});
    y += 20;
  }

  /* Keywords */
  if (keywords && keywords.length > 0 && y < BOTTOM - 30) {
    y = secHead(doc,'Extracted Keywords', y);
    let kx = M;
    for (const kw of keywords.slice(0,12)) {
      if (y > BOTTOM - 28) break;
      doc.fontSize(7.5).font('Helvetica');
      const tw = doc.widthOfString(kw), bw = tw+14;
      if (kx + bw > PW - M) { kx = M; y += 21; }
      rrect(doc, kx, y, bw, 17, 8, C.dimAcc);
      doc.fillColor(C.accent).text(kw, kx+7, y+5, {lineBreak:false});
      kx += bw + 6;
    }
    y += 24;
  }

  /* Disclaimer pinned near bottom */
  const dY = PH - 72;
  hline(doc, M, dY, PW-M, C.border, 0.4);
  doc.fontSize(6.8).font('Helvetica').fillColor(C.muted)
     .text(
       'This report is generated by AI-assisted analysis for research review purposes only. '
       +'Results should be interpreted alongside professional judgment. '
       +'FraudLens does not guarantee the accuracy of automated findings.',
       M, dY+8, { width:CW, lineGap:2, height:40, ellipsis:true }
     );
}

/* ─── Footers on every page ─────────────────────────────────────────── */
function addFooters(doc) {
  const r = doc.bufferedPageRange();
  for (let i = 0; i < r.count; i++) {
    doc.switchToPage(r.start + i);
    const fy = PH - 28;
    hline(doc, M, fy, PW-M, C.border, 0.4);
    txt(doc,'FraudLens  ·  Research Integrity Analysis  ·  Confidential',
      M, fy+9, {size:6.5,color:C.muted});
    txt(doc,`Page ${i+1} of ${r.count}`, M, fy+9,
      {size:6.5,color:C.muted,align:'right'});
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   ROUTE
═══════════════════════════════════════════════════════════════════════ */
router.get('/:uuid/pdf', requireAuth, async (req, res) => {
  const { uuid } = req.params;
  const userId   = req.user.id;
  try {
    const [[meta]] = await pool.query(
      `SELECT uuid,filename,status,risk_level,plagiarism_score,uploaded_at
       FROM papers WHERE uuid=? AND user_id=?`, [uuid, userId]
    );
    if (!meta) return res.status(404).json({ error:'Paper not found' });

    let fraud_report=null, summary=null, keywords=[];
    try {
      const mp = await Paper.findOne({ uuid }).lean();
      if (mp) { fraud_report=mp.fraud_report; summary=mp.summary; keywords=mp.keywords||[]; }
    } catch(_){}

    /* bufferPages=true lets us write footers after all pages are built */
    const doc = new PDFDocument({
      size:'A4', margins:{top:0,bottom:0,left:0,right:0},
      autoFirstPage:true, bufferPages:true, compress:true,
    });
    const safe = meta.filename.replace(/[^a-z0-9_\-\.]/gi,'_');
    res.setHeader('Content-Type','application/pdf');
    res.setHeader('Content-Disposition',`attachment; filename="fraudlens-report-${safe}.pdf"`);
    doc.pipe(res);

    page1(doc, meta, fraud_report);
    page2(doc, summary, keywords);
    addFooters(doc);

    doc.end();
  } catch(err) {
    console.error('PDF export error:', err.message);
    if (!res.headersSent) res.status(500).json({ error:'Failed to generate PDF' });
  }
});

module.exports = router;
