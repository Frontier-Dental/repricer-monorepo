import { Request, Response } from "express";
import {
  BulkDeleteWaitlistItems,
  DeleteWaitlistItem,
  GetWaitlistItems,
} from "../services/mysql-v2";

export async function getWaitlistItems(req: Request, res: Response) {
  const page = req.query.page ? parseInt(req.query.page as string) : 1;
  const pageSize = req.query.pageSize
    ? parseInt(req.query.pageSize as string)
    : 10;
  const offset = (page - 1) * pageSize;
  const sort = req.query.sort ? (req.query.sort as string) : "created_at DESC";
  const status = req.query.status ? (req.query.status as string) : null;
  const startDate = req.query.fromDate ? (req.query.fromDate as string) : null;
  const endDate = req.query.toDate ? (req.query.toDate as string) : null;
  const search = req.query.search ? (req.query.search as string) : null;

  try {
    const waitlistItems = await GetWaitlistItems({
      page,
      pageSize,
      offset,
      sort,
      status,
      startDate,
      endDate,
      search,
    });
    res.render("pages/waitlist", {
      items: waitlistItems.data,
      pageNumber: page,
      pageSize,
      totalDocs: waitlistItems.pagination.total,
      totalPages: waitlistItems.pagination.totalPages,
      groupName: "Waitlist",
      status: status || "",
      fromDate: startDate || "",
      toDate: endDate || "",
      search: req.query.search || "",
      userRole: (req as any).session?.users_id?.userRole || "",
    });
  } catch (error) {
    console.error("Error in getWaitlistItems", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function deleteWaitlistItem(req: Request, res: Response) {
  const id = parseInt(req.params.id);
  const waitlistItem = await DeleteWaitlistItem(id);
  res.json(waitlistItem);
}

export async function bulkDeleteWaitlistItems(req: Request, res: Response) {
  const ids = req.body.ids;
  const waitlistItems = await BulkDeleteWaitlistItems(ids);
  res.json(waitlistItems);
}
