type StoredProgress = {
    highestLevel: number;
};

type DriveFileListResponse = {
    files?: Array<{ id: string; name: string }>;
};

class ProgressStore {
    private readonly storageKey = 'explosive-candy-progress';
    private readonly driveFileName = 'explosive-candy-progress.json';
    private readonly driveListFields = 'files(id,name)';
    private fileIds: Record<string, string> = {};
    private cachedProgress: Record<string, number> = {};

    async load(userId: string, accessToken: string | null): Promise<StoredProgress> {
        const driveLevel = await this.loadFromDrive(userId, accessToken);
        const localLevel = this.readLocal(userId);
        const highestLevel = this.normalizeLevel(driveLevel ?? localLevel);
        this.cacheProgress(userId, highestLevel);
        return { highestLevel };
    }

    async save(userId: string, accessToken: string | null, highestLevel: number): Promise<void> {
        const normalized = this.normalizeLevel(highestLevel);
        const previous = this.cachedProgress[userId] ?? this.readLocal(userId);
        const persistedLevel = Math.max(previous, normalized);
        this.cacheProgress(userId, persistedLevel);
        if (!accessToken) {
            return;
        }
        await this.saveToDrive(userId, accessToken, persistedLevel);
    }

    private normalizeLevel(level: number): number {
        if (!Number.isFinite(level)) {
            return 1;
        }
        const rounded = Math.floor(level);
        return Math.max(1, Math.min(rounded, 50));
    }

    private cacheProgress(userId: string, level: number): void {
        this.cachedProgress[userId] = level;
        const store = this.readStore();
        store[userId] = { highestLevel: level };
        localStorage.setItem(this.storageKey, JSON.stringify(store));
    }

    private readLocal(userId: string): number {
        const store = this.readStore();
        const entry = store[userId];
        if (!entry) {
            return 1;
        }
        return this.normalizeLevel(entry.highestLevel);
    }

    private readStore(): Record<string, StoredProgress> {
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (!raw) return {};
            const parsed = JSON.parse(raw) as Record<string, StoredProgress>;
            return parsed || {};
        } catch (error) {
            console.warn('Failed to read progress store', error);
            return {};
        }
    }

    private async loadFromDrive(userId: string, accessToken: string | null): Promise<number | null> {
        if (!accessToken) {
            return null;
        }
        try {
            const fileId = await this.findDriveFileId(userId, accessToken);
            if (!fileId) {
                return null;
            }
            const response = await fetch(
                'https://www.googleapis.com/drive/v3/files/' + fileId + '?alt=media',
                { headers: { Authorization: 'Bearer ' + accessToken } }
            );
            if (!response.ok) {
                if (response.status === 404) {
                    delete this.fileIds[userId];
                }
                throw new Error('Drive responded with status ' + response.status);
            }
            const payload = (await response.json()) as StoredProgress;
            const highestLevel = this.normalizeLevel(payload?.highestLevel ?? 1);
            this.cachedProgress[userId] = highestLevel;
            return highestLevel;
        } catch (error) {
            console.warn('Failed to load progress from Google Drive', error);
            return null;
        }
    }

    private async saveToDrive(userId: string, accessToken: string, level: number): Promise<void> {
        try {
            const existingFileId = await this.findDriveFileId(userId, accessToken);
            if (existingFileId) {
                try {
                    await this.updateDriveFile(existingFileId, accessToken, level);
                    return;
                } catch (error) {
                    console.warn('Failed to update Drive progress file, retrying with a new file', error);
                    delete this.fileIds[userId];
                }
            }
            const createdId = await this.createDriveFile(userId, accessToken, level);
            if (createdId) {
                this.fileIds[userId] = createdId;
            }
        } catch (error) {
            console.warn('Failed to save progress to Google Drive', error);
        }
    }

    private async findDriveFileId(userId: string, accessToken: string): Promise<string | null> {
        if (this.fileIds[userId]) {
            return this.fileIds[userId];
        }
        const query = encodeURIComponent("name = '" + this.driveFileName + "' and trashed = false");
        try {
            const response = await fetch(
                'https://www.googleapis.com/drive/v3/files?q=' +
                    query +
                    '&spaces=appDataFolder&fields=' +
                    this.driveListFields +
                    '&pageSize=1',
                {
                    headers: { Authorization: 'Bearer ' + accessToken }
                }
            );
            if (!response.ok) {
                throw new Error('Drive responded with status ' + response.status);
            }
            const listing = (await response.json()) as DriveFileListResponse;
            const fileId = listing.files?.[0]?.id;
            if (fileId) {
                this.fileIds[userId] = fileId;
            }
            return fileId ?? null;
        } catch (error) {
            console.warn('Failed to locate Drive progress file', error);
            return null;
        }
    }

    private async createDriveFile(
        userId: string,
        accessToken: string,
        level: number
    ): Promise<string | null> {
        const boundary = 'progress-boundary-' + Math.random().toString(16).slice(2);
        const metadata = { name: this.driveFileName, parents: ['appDataFolder'] };
        const body =
            '--' +
            boundary +
            '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' +
            JSON.stringify(metadata) +
            '\r\n--' +
            boundary +
            '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' +
            JSON.stringify({ highestLevel: level }) +
            '\r\n--' +
            boundary +
            '--';
        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + accessToken,
                'Content-Type': 'multipart/related; boundary=' + boundary
            },
            body
        });
        if (!response.ok) {
            throw new Error('Drive create failed with status ' + response.status);
        }
        const result = (await response.json()) as { id?: string };
        if (result.id) {
            this.fileIds[userId] = result.id;
        }
        return result.id ?? null;
    }

    private async updateDriveFile(fileId: string, accessToken: string, level: number): Promise<void> {
        const response = await fetch(
            'https://www.googleapis.com/upload/drive/v3/files/' + fileId + '?uploadType=media',
            {
                method: 'PATCH',
                headers: {
                    Authorization: 'Bearer ' + accessToken,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ highestLevel: level })
            }
        );
        if (!response.ok) {
            throw new Error('Drive update failed with status ' + response.status);
        }
    }
}

export { ProgressStore };
export type { StoredProgress };
