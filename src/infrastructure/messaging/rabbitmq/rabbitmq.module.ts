import { Module, OnModuleInit, Logger } from '@nestjs/common';
import {
  RabbitMQModule as GolevelupRabbitMQModule,
  AmqpConnection,
} from '@golevelup/nestjs-rabbitmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    GolevelupRabbitMQModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        exchanges: [
          {
            name: configService.get<string>(
              'RABBITMQ_EXCHANGE_NAME',
              'core.domain.events.topic',
            ),
            type: 'topic',
            options: {
              durable: true,
            },
          },
        ],
        uri: configService.get<string>(
          'RABBITMQ_URI',
          'amqp://guest:guest@localhost:5672',
        ),
        connectionInitOptions: {
          wait: true,
          timeout: 7000,
          reject: false,
        },
        enableControllerDiscovery: true,
      }),
    }),
  ],
  exports: [GolevelupRabbitMQModule],
})
export class RabbitMQMessagingModule implements OnModuleInit {
  private readonly logger = new Logger('RabbitMQConnection');

  constructor(private readonly amqpConnection: AmqpConnection) {}

  onModuleInit() {
    if (this.amqpConnection.connected) {
      this.logger.log('✅ RabbitMQ connected successfully');
    } else {
      this.logger.warn('⚠️ RabbitMQ is waiting for connection or connecting...');
    }
  }
}