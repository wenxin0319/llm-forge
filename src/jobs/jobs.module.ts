import { Module, forwardRef } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { ArtifactsModule } from '../artifacts/artifacts.module';

@Module({
  imports: [forwardRef(() => ArtifactsModule)],
  providers: [JobsService],
  controllers: [JobsController],
  exports: [JobsService],
})
export class JobsModule {}
