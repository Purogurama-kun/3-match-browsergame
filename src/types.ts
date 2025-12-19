type GameState = {
    selected: HTMLDivElement | null;
    score: number;
    level: number;
    targetScore: number;
    movesLeft: number;
};

type SwapMode = 'free-swap' | 'require-match';

type SwipeDirection = 'up' | 'down' | 'left' | 'right';

export { GameState, SwapMode, SwipeDirection };
