import fs from 'fs';
import type { Finding, GateMode, IgnoreRule, PagePerformanceAudit, PerformanceRegression } from '../types.js';
import type { DiffResult } from '../baseline/types.js';

export interface HtmlReportOptions {
  target: string;
  mode: GateMode;
  totalPages: number;
  passed: boolean;
  findings: Finding[];
  diffResult?: DiffResult;
  performance?: PagePerformanceAudit[];
  performanceRegressions?: PerformanceRegression[];
  ignoredCount?: number;
  activeIgnores?: IgnoreRule[];
  timestamp?: string;
  durationSeconds?: number;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function generateHtmlReport(options: HtmlReportOptions): string {
  const {
    target,
    mode,
    totalPages,
    passed,
    findings,
    diffResult,
    performance = [],
    performanceRegressions = [],
    ignoredCount = 0,
    activeIgnores = [],
    timestamp = new Date().toISOString(),
    durationSeconds = 0,
  } = options;

  const totalErrors = findings.filter((f) => f.severity === 'error').length;
  const totalWarnings = findings.filter((f) => f.severity === 'warn').length;
  const totalInfo = findings.filter((f) => f.severity === 'info').length;
  const totalRegressions = (diffResult ? diffResult.regressions.length : 0) +
    performanceRegressions.filter((p) => p.reproduced).length;

  const statusColor = passed ? '#059669' : '#dc2626';
  const statusBadge = passed ? 'GATE PASSED' : 'GATE FAILED';

  // Group pages for dropdown filter
  const uniqueUrls = Array.from(new Set(findings.map((f) => f.url))).sort();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>seo-gate Quality Audit Report - ${escapeHtml(target)}</title>
  <style>
    :root {
      --bg: #f8fafc;
      --card-bg: #ffffff;
      --text: #0f172a;
      --text-muted: #64748b;
      --border: #e2e8f0;
      --primary: #2563eb;
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
      --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      --mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: var(--font); background: var(--bg); color: var(--text); line-height: 1.5; padding: 24px; }
    .container { max-width: 1200px; margin: 0 auto; }
    
    /* Header */
    .header { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 24px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .header-left h1 { font-size: 24px; font-weight: 700; display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
    .header-meta { font-size: 14px; color: var(--text-muted); display: flex; gap: 16px; flex-wrap: wrap; }
    .status-badge { font-size: 14px; font-weight: 700; color: #fff; background: ${statusColor}; padding: 8px 16px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.5px; }

    /* KPI Cards */
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .kpi-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 10px; padding: 18px; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
    .kpi-title { font-size: 13px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; margin-bottom: 6px; }
    .kpi-value { font-size: 28px; font-weight: 800; color: var(--text); }
    .kpi-danger { color: var(--danger); }
    .kpi-warning { color: var(--warning); }
    .kpi-success { color: var(--success); }

    /* Controls */
    .controls { background: var(--card-bg); border: 1px solid var(--border); border-radius: 10px; padding: 16px; margin-bottom: 24px; display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
    .search-input { flex: 1; min-width: 250px; padding: 10px 14px; border: 1px solid var(--border); border-radius: 6px; font-size: 14px; outline: none; }
    .search-input:focus { border-color: var(--primary); }
    .select-filter { padding: 10px 14px; border: 1px solid var(--border); border-radius: 6px; font-size: 14px; background: #fff; outline: none; }
    .btn-group { display: flex; gap: 6px; }
    .filter-btn { padding: 8px 14px; border: 1px solid var(--border); border-radius: 6px; background: #fff; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s; }
    .filter-btn.active { background: var(--primary); color: #fff; border-color: var(--primary); }

    /* Tabs */
    .tabs { display: flex; gap: 8px; border-bottom: 2px solid var(--border); margin-bottom: 20px; }
    .tab-btn { padding: 10px 18px; border: none; background: none; font-size: 15px; font-weight: 600; color: var(--text-muted); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px; }
    .tab-btn.active { color: var(--primary); border-bottom-color: var(--primary); }

    /* Findings Cards */
    .finding-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px; margin-bottom: 12px; padding: 18px; box-shadow: 0 1px 2px rgba(0,0,0,0.02); }
    .finding-card.severity-error { border-left: 5px solid var(--danger); }
    .finding-card.severity-warn { border-left: 5px solid var(--warning); }
    .finding-card.severity-info { border-left: 5px solid var(--primary); }
    .finding-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 8px; }
    .finding-title { font-size: 15px; font-weight: 700; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .badge { font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 4px; text-transform: uppercase; }
    .badge-error { background: #fee2e2; color: #991b1b; }
    .badge-warn { background: #fef3c7; color: #92400e; }
    .badge-info { background: #dbeafe; color: #1e40af; }
    .badge-regression { background: #7f1d1d; color: #fff; }
    .finding-url { font-family: var(--mono); font-size: 13px; color: var(--primary); word-break: break-all; margin-bottom: 8px; }
    .finding-msg { font-size: 14px; margin-bottom: 10px; }
    .evidence-block { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 14px; font-family: var(--mono); font-size: 12px; white-space: pre-wrap; word-break: break-all; margin-bottom: 10px; color: #334155; }
    .fix-hint { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 10px 14px; font-size: 13px; color: #166534; display: flex; align-items: center; gap: 8px; }

    /* Tables */
    .table-container { overflow-x: auto; background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px; }
    table { width: 100%; border-collapse: collapse; text-align: left; font-size: 14px; }
    th { background: #f8fafc; padding: 12px 16px; font-weight: 600; color: var(--text-muted); border-bottom: 1px solid var(--border); }
    td { padding: 12px 16px; border-bottom: 1px solid var(--border); vertical-align: middle; }
    tr:last-child td { border-bottom: none; }
    .mono { font-family: var(--mono); font-size: 13px; }

    /* Empty state */
    .empty-state { text-align: center; padding: 48px; color: var(--text-muted); font-size: 16px; }

    /* Footer */
    .footer { text-align: center; font-size: 13px; color: var(--text-muted); margin-top: 36px; padding: 16px; border-top: 1px solid var(--border); }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <header class="header">
      <div class="header-left">
        <h1>🛡️ seo-gate Quality Audit</h1>
        <div class="header-meta">
          <span><strong>Target:</strong> <a href="${escapeHtml(target)}" target="_blank" rel="noopener">${escapeHtml(target)}</a></span>
          <span><strong>Mode:</strong> ${escapeHtml(mode)}</span>
          <span><strong>Date:</strong> ${escapeHtml(timestamp)}</span>
          ${durationSeconds > 0 ? `<span><strong>Duration:</strong> ${durationSeconds}s</span>` : ''}
        </div>
      </div>
      <div class="status-badge">${statusBadge}</div>
    </header>

    <!-- KPI Summary Grid -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-title">Pages Audited</div>
        <div class="kpi-value">${totalPages}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">Regressions</div>
        <div class="kpi-value ${totalRegressions > 0 ? 'kpi-danger' : 'kpi-success'}">${totalRegressions}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">Errors</div>
        <div class="kpi-value ${totalErrors > 0 ? 'kpi-danger' : 'kpi-success'}">${totalErrors}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">Warnings</div>
        <div class="kpi-value ${totalWarnings > 0 ? 'kpi-warning' : ''}">${totalWarnings}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">Active Ignores</div>
        <div class="kpi-value">${ignoredCount}</div>
      </div>
    </div>

    <!-- Controls -->
    <div class="controls">
      <input type="text" id="searchInput" class="search-input" placeholder="Search by URL, check ID, or message...">
      <select id="urlFilter" class="select-filter">
        <option value="">All Pages (${uniqueUrls.length})</option>
        ${uniqueUrls.map((u) => `<option value="${escapeHtml(u)}">${escapeHtml(u)}</option>`).join('')}
      </select>
      <div class="btn-group">
        <button class="filter-btn active" data-filter="all">All (${findings.length})</button>
        <button class="filter-btn" data-filter="error">Errors (${totalErrors})</button>
        <button class="filter-btn" data-filter="warn">Warnings (${totalWarnings})</button>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <div class="tabs">
      <button class="tab-btn active" data-tab="findings-view">Findings (${findings.length})</button>
      <button class="tab-btn" data-tab="performance-view">Lab Performance (${performance.length})</button>
      <button class="tab-btn" data-tab="ignores-view">Active Ignores (${activeIgnores.length})</button>
    </div>

    <!-- TAB 1: Findings View -->
    <div id="findings-view" class="tab-content">
      ${findings.length === 0 ? `
        <div class="empty-state">
          <h3>🎉 No SEO findings detected!</h3>
          <p>All pages passed audited quality standards.</p>
        </div>
      ` : `
        <div id="findingsContainer">
          ${findings.map((f) => {
            const isRegr = diffResult?.regressions.some((r) => r.url === f.url && r.checkId === f.checkId);
            return `
              <div class="finding-card severity-${escapeHtml(f.severity)}" data-severity="${escapeHtml(f.severity)}" data-url="${escapeHtml(f.url)}" data-check="${escapeHtml(f.checkId)}">
                <div class="finding-header">
                  <div class="finding-title">
                    <span class="badge badge-${escapeHtml(f.severity)}">${escapeHtml(f.severity)}</span>
                    ${isRegr ? '<span class="badge badge-regression">REGRESSION</span>' : ''}
                    <span>${escapeHtml(f.checkId)}</span>
                  </div>
                  ${f.docsLink ? `<a href="${escapeHtml(f.docsLink)}" target="_blank" rel="noopener" style="font-size:12px; color:var(--primary); text-decoration:none;">Docs ↗</a>` : ''}
                </div>
                <div class="finding-url">${escapeHtml(f.url)}</div>
                <div class="finding-msg">${escapeHtml(f.message)}</div>
                ${f.evidence ? `<div class="evidence-block"><strong>Evidence:</strong> ${escapeHtml(f.evidence)}</div>` : ''}
                ${f.fixHint ? `<div class="fix-hint">💡 <strong>Fix:</strong> ${escapeHtml(f.fixHint)}</div>` : ''}
              </div>
            `;
          }).join('')}
        </div>
      `}
    </div>

    <!-- TAB 2: Performance View -->
    <div id="performance-view" class="tab-content" style="display: none;">
      <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; padding:12px 16px; margin-bottom:16px; font-size:13px; color:#1e40af;">
        ℹ️ <strong>Lab Audit Notice:</strong> Metrics are captured using headless Chromium with simulated mobile/desktop profiles (median of runs). These are synthetic lab metrics to catch code regressions, not field Core Web Vitals.
      </div>
      ${performance.length === 0 ? `
        <div class="empty-state">
          <h3>No lab performance audits recorded</h3>
          <p>Configure <code>pages.critical</code> and performance budgets to activate Lighthouse auditing.</p>
        </div>
      ` : `
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Page URL</th>
                <th>Profile</th>
                <th>LCP (ms)</th>
                <th>CLS</th>
                <th>TBT (ms)</th>
                <th>Total JS</th>
                <th>Total Images</th>
                <th>Runs</th>
              </tr>
            </thead>
            <tbody>
              ${performance.map((p) => `
                <tr>
                  <td class="mono"><strong>${escapeHtml(p.url)}</strong></td>
                  <td>${escapeHtml(p.metrics.profile)}</td>
                  <td class="${p.metrics.lcpMs > 2500 ? 'kpi-danger' : 'kpi-success'}">${p.metrics.lcpMs} ms</td>
                  <td class="${p.metrics.cls > 0.1 ? 'kpi-danger' : 'kpi-success'}">${p.metrics.cls}</td>
                  <td class="${p.metrics.tbtMs > 300 ? 'kpi-danger' : 'kpi-success'}">${p.metrics.tbtMs} ms</td>
                  <td>${p.metrics.totalJsKb} kB</td>
                  <td>${p.metrics.totalImageKb} kB</td>
                  <td>${p.runs}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `}
      ${performanceRegressions.length > 0 ? `
        <h3 style="margin:24px 0 12px 0; font-size:16px;">Performance Regressions & Budget Exceedances</h3>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Page URL</th>
                <th>Metric</th>
                <th>Current</th>
                <th>Baseline</th>
                <th>Budget</th>
                <th>Delta</th>
                <th>Reproduced?</th>
              </tr>
            </thead>
            <tbody>
              ${performanceRegressions.map((pr) => `
                <tr>
                  <td class="mono">${escapeHtml(pr.url)}</td>
                  <td><strong>${escapeHtml(pr.metric)}</strong></td>
                  <td>${pr.current}</td>
                  <td>${pr.baseline !== undefined ? pr.baseline : '-'}</td>
                  <td>${pr.budget !== undefined ? pr.budget : '-'}</td>
                  <td class="kpi-danger">+${pr.deltaPercent}%</td>
                  <td>${pr.reproduced ? '<span class="badge badge-error">CONFIRMED</span>' : '<span class="badge badge-warn">TRANSIENT</span>'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}
    </div>

    <!-- TAB 3: Active Ignores View -->
    <div id="ignores-view" class="tab-content" style="display: none;">
      ${activeIgnores.length === 0 ? `
        <div class="empty-state">
          <h3>No active ignores</h3>
          <p>All check violations are reported according to standard severities.</p>
        </div>
      ` : `
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Check Rule</th>
                <th>URL Pattern</th>
                <th>Documented Reason</th>
                <th>Expires</th>
              </tr>
            </thead>
            <tbody>
              ${activeIgnores.map((rule) => `
                <tr>
                  <td><code>${escapeHtml(rule.check)}</code></td>
                  <td class="mono">${escapeHtml(rule.url)}</td>
                  <td>${escapeHtml(rule.reason)}</td>
                  <td>${rule.expires ? escapeHtml(rule.expires) : '<span style="color:var(--text-muted);">Never</span>'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `}
    </div>

    <footer class="footer">
      Generated automatically by <strong>seo-gate v0.1.0</strong> • Automated SEO Regression Guard for CI/CD
    </footer>
  </div>

  <script>
    // Tab switching
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        contents.forEach(c => c.style.display = 'none');
        tab.classList.add('active');
        const targetId = tab.getAttribute('data-tab');
        document.getElementById(targetId).style.display = 'block';
      });
    });

    // Filtering
    const searchInput = document.getElementById('searchInput');
    const urlFilter = document.getElementById('urlFilter');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const cards = document.querySelectorAll('.finding-card');

    let currentSeverity = 'all';

    function applyFilters() {
      const query = (searchInput.value || '').toLowerCase();
      const selectedUrl = urlFilter.value;

      cards.forEach(card => {
        const severity = card.getAttribute('data-severity');
        const url = card.getAttribute('data-url');
        const text = card.textContent.toLowerCase();

        const matchesSeverity = currentSeverity === 'all' || severity === currentSeverity;
        const matchesUrl = !selectedUrl || url === selectedUrl;
        const matchesQuery = !query || text.includes(query);

        if (matchesSeverity && matchesUrl && matchesQuery) {
          card.style.display = 'block';
        } else {
          card.style.display = 'none';
        }
      });
    }

    searchInput?.addEventListener('input', applyFilters);
    urlFilter?.addEventListener('change', applyFilters);
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentSeverity = btn.getAttribute('data-filter');
        applyFilters();
      });
    });
  </script>
</body>
</html>`;
}

export function writeHtmlReport(html: string, filePath: string): void {
  fs.writeFileSync(filePath, html, 'utf-8');
}
