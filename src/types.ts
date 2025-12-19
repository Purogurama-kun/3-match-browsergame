type GameState = {
    selected: HTMLDivElement | null;
    score: number;
    level: number;
    targetScore: number;
    movesLeft: number;
};

type SwapMode = 'free-swap' | 'require-match';

export { GameState, SwapMode };
