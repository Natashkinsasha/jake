import { Controller, Get } from "@nestjs/common";
import type { HealthMaintainer } from "../application/health.maintainer";

@Controller("health")
export class HealthController {
  constructor(private healthMaintainer: HealthMaintainer) {}

  @Get()
  async check() {
    return this.healthMaintainer.check();
  }
}
