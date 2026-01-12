export type ParticleOptions = {
    count?: number;
    minDistance?: number;
    maxDistance?: number;
    minDuration?: number;
    maxDuration?: number;
    delayVariance?: number;
    accentColor?: string;
};

export type ShockwaveType = 'line' | 'small' | 'medium' | 'large';

class ParticleEffect {
    private container: HTMLDivElement = this.createContainer();

    constructor(private readonly boardEl: HTMLElement) {
        this.boardEl.appendChild(this.container);
    }

    reset(): void {
        if (this.container.parentElement !== this.boardEl) {
            this.container = this.createContainer();
            this.boardEl.appendChild(this.container);
        }
        this.container.innerHTML = '';
    }

    emitFromCell(cell: HTMLDivElement, color: string | null, options: ParticleOptions = {}): void {
        const boardRect = this.boardEl.getBoundingClientRect();
        const cellRect = cell.getBoundingClientRect();
        const centerX = cellRect.left + cellRect.width / 2 - boardRect.left;
        const centerY = cellRect.top + cellRect.height / 2 - boardRect.top;

        const count = options.count ?? 16;
        const minDistance = options.minDistance ?? 14;
        const maxDistance = Math.max(options.maxDistance ?? minDistance + 16, minDistance + 0.5);
        const durationBase = options.minDuration ?? 0.58;
        const durationRange = Math.max((options.maxDuration ?? durationBase) - durationBase, 0.01);
        const delayVariance = Math.max(options.delayVariance ?? 0.18, 0);
        const baseColor = color || '#fefefe';

        for (let i = 0; i < count; i++) {
            const particle = document.createElement('span');
            particle.className = 'board__particle';
            particle.style.left = `${centerX}px`;
            particle.style.top = `${centerY}px`;
            particle.style.setProperty('--particle-color', baseColor);
            const angle = Math.random() * Math.PI * 2;
            const distance =
                minDistance + Math.random() * Math.max(maxDistance - minDistance, 0.5);
            particle.style.setProperty('--particle-x', `${Math.cos(angle) * distance}px`);
            particle.style.setProperty('--particle-y', `${Math.sin(angle) * distance}px`);
            const duration = durationBase + Math.random() * durationRange;
            particle.style.setProperty('--particle-duration', `${duration}s`);
            const delay = Math.random() * delayVariance;
            particle.style.setProperty('--particle-delay', `${delay}s`);
            particle.addEventListener('animationend', () => particle.remove(), { once: true });
            this.container.appendChild(particle);
        }
    }

    emitShockwave(cell: HTMLDivElement, type: ShockwaveType): void {
        const boardRect = this.boardEl.getBoundingClientRect();
        const cellRect = cell.getBoundingClientRect();
        const centerX = cellRect.left + cellRect.width / 2 - boardRect.left;
        const centerY = cellRect.top + cellRect.height / 2 - boardRect.top;

        const shockwave = document.createElement('div');
        shockwave.className = `board__shockwave board__shockwave--${type}`;
        shockwave.style.left = `${centerX}px`;
        shockwave.style.top = `${centerY}px`;
        shockwave.addEventListener('animationend', () => shockwave.remove(), { once: true });
        this.container.appendChild(shockwave);
    }

    emitFlash(type: ShockwaveType | 'combo'): void {
        const flash = document.createElement('div');
        flash.className = `board__flash board__flash--${type}`;
        flash.addEventListener('animationend', () => flash.remove(), { once: true });
        this.boardEl.appendChild(flash);
    }

    emitComboShockwave(cell: HTMLDivElement, strength: number = 0.5): void {
        const boardRect = this.boardEl.getBoundingClientRect();
        const cellRect = cell.getBoundingClientRect();
        const centerX = cellRect.left + cellRect.width / 2 - boardRect.left;
        const centerY = cellRect.top + cellRect.height / 2 - boardRect.top;

        const scale = Math.min(Math.max(strength, 0.2), 1);

        const outerRing = document.createElement('div');
        outerRing.className = 'board__shockwave board__shockwave--combo';
        outerRing.style.left = `${centerX}px`;
        outerRing.style.top = `${centerY}px`;
        outerRing.style.setProperty('--combo-scale', String(scale));
        outerRing.addEventListener('animationend', () => outerRing.remove(), { once: true });
        this.container.appendChild(outerRing);

        const innerRing = document.createElement('div');
        innerRing.className = 'board__shockwave board__shockwave--combo-inner';
        innerRing.style.left = `${centerX}px`;
        innerRing.style.top = `${centerY}px`;
        innerRing.style.setProperty('--combo-scale', String(scale));
        innerRing.addEventListener('animationend', () => innerRing.remove(), { once: true });
        this.container.appendChild(innerRing);
    }

    emitComboSparks(cell: HTMLDivElement, strength: number = 0.5): void {
        const boardRect = this.boardEl.getBoundingClientRect();
        const cellRect = cell.getBoundingClientRect();
        const centerX = cellRect.left + cellRect.width / 2 - boardRect.left;
        const centerY = cellRect.top + cellRect.height / 2 - boardRect.top;

        const sparkCount = Math.round(12 + strength * 24);
        const baseDistance = 20 + strength * 50;
        const distanceVariance = 20 + strength * 50;

        for (let i = 0; i < sparkCount; i++) {
            const spark = document.createElement('span');
            spark.className = 'board__combo-spark';
            spark.style.left = `${centerX}px`;
            spark.style.top = `${centerY}px`;

            const angle = (i / sparkCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
            const distance = baseDistance + Math.random() * distanceVariance;
            spark.style.setProperty('--spark-x', `${Math.cos(angle) * distance}px`);
            spark.style.setProperty('--spark-y', `${Math.sin(angle) * distance}px`);
            spark.style.setProperty('--spark-duration', `${0.35 + strength * 0.4 + Math.random() * 0.25}s`);
            spark.style.setProperty('--spark-delay', `${Math.random() * 0.08}s`);

            spark.addEventListener('animationend', () => spark.remove(), { once: true });
            this.container.appendChild(spark);
        }
    }

    private createContainer(): HTMLDivElement {
        const container = document.createElement('div');
        container.className = 'board__particles';
        return container;
    }
}

export { ParticleEffect };
