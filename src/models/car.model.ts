import { Request, Response, NextFunction } from 'express';

export class Car {
    _model: any;
    constructor(norm: any) {
        this.model = [{
            id: { type: Number, key: 'primary' },
            make: { type: String, maxlength: 24 },
            model: { type: String, maxlength: 24 },
            year: { type: String, maxlength: 24 },
            mileage: { type: String, maxlength: 24 },
            user_id: {
                type: Number,
                key: 'foreign',
                references: { table: 'User', foreignKey: 'id' },
                onDelete: 'cascade',
                onUpdate: 'cascade'
            },
        }, 'A table to store car info',
        [
            {
                route: '/get-all-cars',
                method: 'POST',
                callback: this.getAllCars,
                requireToken: true,
            },
            {
                route: '/get-car-by-id/:id',
                method: 'POST',
                callback: this.getCarById,
                requireToken: true,
            }
        ]];
    }

    getAllCars(model: any) {
        return async (req: Request, res: Response, next: NextFunction) => {
            req.body = {
                get: ['*']
            }
            let carCtrl = model.controller;
            let resp = await carCtrl.get(req, null, null);
            res.json({ message: 'Success', resp });
        }
    }

    getCarById(model: any) {
        return async (req: Request, res: Response, next: NextFunction) => {
            req.body = {
                get: ['*'],
                where: {
                    id: req.params.id
                }
            }
            let carCtrl = model.controller;
            let resp = await carCtrl.get(req, null, null);
            res.json({ message: 'Success', resp });
        }
    }

    set model(model: any) {
        this._model = model;
    }

    get model() {
        return this._model;
    }

}