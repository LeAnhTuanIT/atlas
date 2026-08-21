import { Module, OnModuleInit, Inject, Logger } from '@nestjs/common';
import { ClientKafka, ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';

export const KAFKA_SERVICE = 'KAFKA_SERVICE';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: KAFKA_SERVICE,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId: configService.get<string>('KAFKA_CLIENT_ID', 'nestjs-app'),
              brokers: configService
                .get<string>('KAFKA_BROKERS', 'localhost:9092')
                .split(','),
            },
            consumer: {
              groupId: configService.get<string>(
                'KAFKA_GROUP_ID',
                'nestjs-consumer-group',
              ),
            },
          },
        }),
      },
    ]),
  ],
  exports: [ClientsModule],
})
export class KafkaMessagingModule implements OnModuleInit {
  private readonly logger = new Logger('KafkaConnection');

  constructor(@Inject(KAFKA_SERVICE) private readonly kafkaClient: ClientKafka) {}

  async onModuleInit() {
    try {
      // Đăng ký topics cần nhận response nếu dùng request-response pattern (send)
      // this.kafkaClient.subscribeToResponseOf('order.created');

      await this.kafkaClient.connect();
      this.logger.log('✅ Kafka Producer/Client connected successfully');
    } catch (error: any) {
      this.logger.error(`❌ Kafka connection failed: ${error.message}`);
    }
  }
}