import { applyDecorators } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';

export function Transaction() {
  return applyDecorators(Transactional('pg'));
}
