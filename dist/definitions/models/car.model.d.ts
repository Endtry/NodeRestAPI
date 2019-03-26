import { Request, Response, NextFunction } from 'express';
export declare class Car {
    _model: any;
    constructor(norm: any);
    getAllCars(model: any): (req: Request, res: Response, next: NextFunction) => Promise<void>;
    getCarById(model: any): (req: Request, res: Response, next: NextFunction) => Promise<void>;
    model: any;
}
