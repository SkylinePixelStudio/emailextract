import { Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from './auth';

const prisma = new PrismaClient();

export function auditLog(action: string, entity: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const originalSend = res.json.bind(res);
    
    res.json = function(body: any) {
      prisma.auditLog.create({
        data: {
          action,
          entity,
          entityId: req.params.id || body?.id,
          details: JSON.stringify({ body: req.body, query: req.query }),
          userId: req.user?.id,
          ip: req.ip,
        },
      }).catch(() => {});
      
      return originalSend(body);
    };
    
    next();
  };
}
