
enum InstaxFilmType {
    MINI = "MINI",
    SQUARE = "SQUARE",
    LARGE = "LARGE",
}

interface InstaxFilmTypeDimensions {
    [InstaxFilmType.MINI]: { width: number; height: number };
    [InstaxFilmType.SQUARE]: { width: number; height: number };
    [InstaxFilmType.LARGE]: { width: number; height: number };
}

const InstaxFilmTypes: InstaxFilmTypeDimensions = {
    [InstaxFilmType.MINI]: { width: 600, height: 800 },
    [InstaxFilmType.SQUARE]: { width: 800, height: 800 },
    [InstaxFilmType.LARGE]: { width: 840, height: 1240 },
};

export interface AppConfig {

	type: InstaxFilmType, 

	theme: string;

	connect: () => Promise<void>,
	disconnect: () => Promise<void>;
}