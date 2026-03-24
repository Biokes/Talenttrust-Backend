import express, { Express, Request, Response } from 'express';

 /**
  * Core Express app for TalentTrust Backend.
  * Mounts routes and middleware.
  */
 export class TalentTrustApp {
   private app: Express;

   constructor() {
     this.app = express();
     this.app.use(express.json());
     this.mountRoutes();
   }

   private mountRoutes(): void {
     // API routes
     this.app.get('/api/v1/contracts', (_req: Request, res: Response) => {
       res.json({ contracts: [] });
     });
   }

   getApp(): Express {
     return this.app;
   }
 }

