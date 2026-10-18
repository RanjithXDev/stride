import { Router } from "express";
import { authenticate } from "../middleware/auth";
import {
  listTickets, getTicket, createTicket,
  updateTicket, deleteTicket, bulkUpdateTickets,
  addComment, updateComment, deleteComment,
  logTime, addLink, removeLink, restoreTicket,
} from "../controllers/ticket.controller";
import { listTicketAudit } from "../controllers/audit.controller";

const router = Router();

router.use(authenticate);

router.get("/",       listTickets);
router.post("/",      createTicket);
router.post("/bulk",  bulkUpdateTickets);
router.get("/:id", getTicket);
router.put("/:id", updateTicket);
router.delete("/:id", deleteTicket);
router.post("/:id/restore", restoreTicket);
router.get("/:id/audit-events", listTicketAudit);

router.post("/:id/comments",              addComment);
router.put("/:id/comments/:commentId",    updateComment);
router.delete("/:id/comments/:commentId", deleteComment);

router.post("/:id/time", logTime);

router.post("/:id/links",      addLink);
router.delete("/links/:linkId", removeLink);

export default router;
