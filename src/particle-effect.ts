export type ParticleOptions = {
    count?: number;
    minDistance?: number;
    maxDistance?: number;
    minDuration?: number;
    maxDuration?: number;
    delayVariance?: number;
    accentColor?: string;
};

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

    private createContainer(): HTMLDivElement {
        const container = document.createElement('div');
        container.className = 'board__particles';
        return container;
    }
}

export { ParticleEffect };
