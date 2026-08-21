import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get('health')
  healthCheck(): { status: string; message: string } {
    return {
      status: 'OK',
      message: 'Service is healthy and running.',
    };
  }
}
