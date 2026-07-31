import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { createObjectCsvWriter } from 'csv-writer';
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import { authenticate } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.post('/csv', authenticate, async (req, res, next) => {
  try {
    const { ids } = req.body;
    const contacts = await prisma.contact.findMany({
      where: ids?.length ? { id: { in: ids } } : {},
    });

    const filename = `export-${Date.now()}.csv`;
    const filepath = path.join(process.cwd(), 'exports', filename);
    
    const csvWriter = createObjectCsvWriter({
      path: filepath,
      header: [
        { id: 'companyName', title: 'Company Name' },
        { id: 'website', title: 'Website' },
        { id: 'email', title: 'Email' },
        { id: 'phone', title: 'Phone' },
        { id: 'sourceUrl', title: 'Source URL' },
        { id: 'pageTitle', title: 'Page Title' },
        { id: 'tags', title: 'Tags' },
        { id: 'notes', title: 'Notes' },
      ],
    });

    await csvWriter.writeRecords(contacts);
    res.download(filepath, filename, (err) => {
      if (!err) fs.unlinkSync(filepath);
    });
  } catch (err) {
    next(err);
  }
});

router.post('/excel', authenticate, async (req, res, next) => {
  try {
    const { ids } = req.body;
    const contacts = await prisma.contact.findMany({
      where: ids?.length ? { id: { in: ids } } : {},
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Contacts');
    
    worksheet.columns = [
      { header: 'Company Name', key: 'companyName', width: 30 },
      { header: 'Website', key: 'website', width: 30 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Phone', key: 'phone', width: 20 },
      { header: 'Source URL', key: 'sourceUrl', width: 40 },
      { header: 'Page Title', key: 'pageTitle', width: 30 },
      { header: 'Tags', key: 'tags', width: 20 },
      { header: 'Notes', key: 'notes', width: 30 },
    ];

    contacts.forEach((c) => worksheet.addRow(c));
    
    const filename = `export-${Date.now()}.xlsx`;
    const filepath = path.join(process.cwd(), 'exports', filename);
    await workbook.xlsx.writeFile(filepath);
    
    res.download(filepath, filename, (err) => {
      if (!err) fs.unlinkSync(filepath);
    });
  } catch (err) {
    next(err);
  }
});

router.post('/json', authenticate, async (req, res, next) => {
  try {
    const { ids } = req.body;
    const contacts = await prisma.contact.findMany({
      where: ids?.length ? { id: { in: ids } } : {},
    });
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=export-${Date.now()}.json`);
    res.send(JSON.stringify(contacts, null, 2));
  } catch (err) {
    next(err);
  }
});

export default router;
