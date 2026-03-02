import { Injectable } from "@nestjs/common";
import { MemoryFactDao } from "../../infrastructure/dao/memory-fact.dao";

@Injectable()
export class MemoryRetrievalService {
  constructor(private factDao: MemoryFactDao) {}

  async retrieve(userId: string, _query: string) {
    return this.factDao.findActiveByUser(userId, 50);
  }
}
