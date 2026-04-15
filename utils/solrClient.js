/**
 * Minimal Solr client helpers (HTTP) for full-text search.
 *
 * Configuration:
 * - SOLR_URL=http://localhost:8983/solr
 *
 * This module is intentionally dependency-light: it uses axios and works as an optional integration.
 */

const axios = require('axios');

function getSolrBaseUrl() {
    const base = process.env.SOLR_URL;
    if (!base) return null;
    return String(base).replace(/\/+$/, '');
}

function isSolrEnabled() {
    return Boolean(getSolrBaseUrl());
}

function coreUrl(core) {
    const base = getSolrBaseUrl();
    if (!base) return null;
    return `${base}/${core}`;
}

function escapeSolrQuotedValue(value) {
    // Wrap in quotes and escape characters that would break a Solr query string.
    const s = String(value ?? '');
    return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

async function solrSelect(core, params) {
    const base = coreUrl(core);
    if (!base) {
        const err = new Error('Solr is not enabled (SOLR_URL not set)');
        err.code = 'SOLR_DISABLED';
        throw err;
    }

    const response = await axios.get(`${base}/select`, {
        params: {
            wt: 'json',
            ...params
        },
        timeout: 5000
    });

    return response.data;
}

async function solrUpdate(core, body, { commit = true } = {}) {
    const base = coreUrl(core);
    if (!base) {
        const err = new Error('Solr is not enabled (SOLR_URL not set)');
        err.code = 'SOLR_DISABLED';
        throw err;
    }

    const response = await axios.post(`${base}/update`, body, {
        params: { commit: commit ? 'true' : 'false' },
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
    });

    return response.data;
}

/**
 * Search user IDs in Solr.
 * Returns IDs in relevance order.
 */
async function searchUserIds(search, options = {}) {
    const term = String(search || '').trim();
    if (!term) {
        return { ids: [], total: 0 };
    }

    const start = Number.isFinite(Number(options.start)) ? Number(options.start) : 0;
    const rows = Number.isFinite(Number(options.rows)) ? Number(options.rows) : 20;

    const qf = [
        'email_t^5',
        'phone_t^4',
        'fullName_t^4',
        'firstName_t^3',
        'lastName_t^3'
    ].join(' ');

    const fqs = [];

    // Always exclude ADMIN from search results.
    fqs.push('-role_s:ADMIN');

    const role = options.role ? String(options.role).toUpperCase() : null;
    if (role && role !== 'ALL') {
        fqs.push(`role_s:${escapeSolrQuotedValue(role)}`);
    }

    const status = options.status ? String(options.status).toUpperCase() : null;
    if (status && status !== 'ALL') {
        fqs.push(`accountStatus_s:${escapeSolrQuotedValue(status)}`);
    }

    const data = await solrSelect('users', {
        q: term,
        defType: 'edismax',
        qf,
        start,
        rows,
        fl: 'id,score',
        fq: fqs
    });

    const docs = data?.response?.docs || [];
    const ids = docs.map((d) => d.id).filter(Boolean);
    const total = Number(data?.response?.numFound || 0);

    return { ids, total };
}

async function upsertUsers(docs, { commit = true } = {}) {
    const payload = Array.isArray(docs) ? docs : [docs];
    return solrUpdate('users', payload, { commit });
}

async function deleteUsersByQuery(query = '*:*', { commit = true } = {}) {
    return solrUpdate('users', { delete: { query: String(query) } }, { commit });
}

module.exports = {
    isSolrEnabled,
    searchUserIds,
    upsertUsers,
    deleteUsersByQuery
};
