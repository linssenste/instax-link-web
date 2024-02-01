
enum FilmSize {
    MINI = "MINI",
    SQUARE = "SQUARE",
    LARGE = "LARGE",
}

interface FilmSizeDimensions {
    [FilmSize.MINI]: { width: number; height: number };
    [FilmSize.SQUARE]: { width: number; height: number };
    [FilmSize.LARGE]: { width: number; height: number };
}

const filmSizes: FilmSizeDimensions = {
    [FilmSize.MINI]: { width: 600, height: 800 },
    [FilmSize.SQUARE]: { width: 800, height: 800 },
    [FilmSize.LARGE]: { width: 840, height: 1240 },
};

export interface AppConfig {

	type: FilmSize, 

	theme: string;

	connect: () => Promise<void>,
	disconnect: () => Promise<void>;
}