import { Module } from '@nestjs/common';
import { ClsModule } from 'nestjs-cls';

@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
        resolveProxyProviders: false,
      },
      interceptor: {
        resolveProxyProviders: true,
      },
    }),
  ],
  exports: [ClsModule],
})
export class SharedClsModule {}
