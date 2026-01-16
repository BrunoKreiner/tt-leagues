const database = require('../models/database');

const SNAPSHOT_VERSION = 1;

const parseSnapshotPayload = (payload) => {
    if (payload == null) return null;
    if (typeof payload === 'string') {
        return JSON.parse(payload);
    }
    return payload;
};

async function getCachedLeagueSnapshot(leagueId) {
    const row = await database.get(
        'SELECT payload, updated_at, dirty, version FROM league_snapshots WHERE league_id = ?',
        [leagueId]
    );
    if (!row || row.dirty) {
        return null;
    }
    if (typeof row.version === 'number' && row.version !== SNAPSHOT_VERSION) {
        return null;
    }
    const payload = parseSnapshotPayload(row.payload);
    if (!payload) {
        return null;
    }
    return {
        payload,
        updated_at: row.updated_at,
        version: row.version
    };
}

async function saveLeagueSnapshot(leagueId, payload) {
    const snapshotPayload = JSON.stringify(payload);
    await database.run(
        `INSERT INTO league_snapshots (league_id, payload, updated_at, dirty, version)
         VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?)
         ON CONFLICT(league_id) DO UPDATE SET
            payload = excluded.payload,
            updated_at = CURRENT_TIMESTAMP,
            dirty = excluded.dirty,
            version = excluded.version`,
        [leagueId, snapshotPayload, false, SNAPSHOT_VERSION]
    );
}

async function markLeagueSnapshotDirty(leagueId) {
    await database.run(
        'UPDATE league_snapshots SET dirty = ?, updated_at = CURRENT_TIMESTAMP WHERE league_id = ?',
        [true, leagueId]
    );
}

module.exports = {
    SNAPSHOT_VERSION,
    getCachedLeagueSnapshot,
    saveLeagueSnapshot,
    markLeagueSnapshotDirty
};
