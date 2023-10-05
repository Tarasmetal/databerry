import { DatasourceStatus } from '@chaindesk/prisma';
import Redis from 'ioredis';

import { TaskQueue } from '@chaindesk/lib/types';
import { TaskLoadDatasourceRequestSchema } from '@chaindesk/lib/types/dtos';
import { WorkerPro } from '@chaindesk/lib/bullmq-pro';
import logger from '@chaindesk/lib/logger';
import { prisma } from '@chaindesk/prisma/client';
import taskLoadDatasource from '@chaindesk/lib/task-load-datasource';

const connection = new Redis(process.env.REDIS_URL!);

const datasourceLoadQueue = new WorkerPro(
  TaskQueue.load_datasource,
  async (job) => {
    const data = job?.data as TaskLoadDatasourceRequestSchema;
    try {
      logger.info(data);

      await taskLoadDatasource(data);

      return;
    } catch (err) {
      // TODO: handle error
      logger.error(err);

      await prisma.appDatasource.update({
        where: {
          id: data?.datasourceId,
        },
        data: {
          status: DatasourceStatus.error,
        },
      });

      throw new Error(JSON.stringify(err));
    }
  },
  {
    connection: connection as any,
    concurrency: 5,
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  }
);

export default datasourceLoadQueue;