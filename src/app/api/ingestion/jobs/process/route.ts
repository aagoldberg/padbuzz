import { NextRequest, NextResponse } from 'next/server';
import {
  getNextJob,
  completeJob,
  failJob,
  getJobsCollection,
} from '@/ingestion/db';
import { runCrawl } from '@/ingestion/orchestrator';

/**
 * POST /api/ingestion/jobs/process
 * Process pending jobs from the queue
 * Can be called by Vercel Cron or manually
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const maxJobs = parseInt(searchParams.get('max') || '5', 10);

  const processed: { jobId: string; type: string; status: string }[] = [];
  let processedCount = 0;

  try {
    while (processedCount < maxJobs) {
      const job = await getNextJob();

      if (!job) {
        // No more pending jobs
        break;
      }

      console.log(`Processing job ${job.jobId} (${job.type})...`);

      try {
        switch (job.type) {
          case 'refresh':
          case 'fetch': {
            const sourceId = job.payload.sourceId as string;
            if (!sourceId) {
              throw new Error('Missing sourceId in job payload');
            }

            const result = await runCrawl(sourceId, {
              maxPages: 3,
              maxListings: 200,
            });

            await completeJob(job._id!.toString(), result);
            processed.push({
              jobId: job.jobId,
              type: job.type,
              status: 'completed',
            });
            break;
          }

          case 'parse': {
            // TODO: Implement standalone parse job
            await completeJob(job._id!.toString(), { skipped: true });
            processed.push({
              jobId: job.jobId,
              type: job.type,
              status: 'skipped',
            });
            break;
          }

          case 'dedup': {
            // TODO: Implement deduplication job
            await completeJob(job._id!.toString(), { skipped: true });
            processed.push({
              jobId: job.jobId,
              type: job.type,
              status: 'skipped',
            });
            break;
          }

          case 'analyze': {
            // TODO: Implement image analysis job
            await completeJob(job._id!.toString(), { skipped: true });
            processed.push({
              jobId: job.jobId,
              type: job.type,
              status: 'skipped',
            });
            break;
          }

          default:
            throw new Error(`Unknown job type: ${job.type}`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        await failJob(job._id!.toString(), errorMsg);
        processed.push({
          jobId: job.jobId,
          type: job.type,
          status: `failed: ${errorMsg}`,
        });
      }

      processedCount++;
    }

    return NextResponse.json({
      message: `Processed ${processedCount} jobs`,
      processed,
    });
  } catch (error) {
    console.error('Job processing error:', error);
    return NextResponse.json(
      { error: `Job processing failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ingestion/jobs/process
 * Get job queue status
 */
export async function GET() {
  try {
    const collection = await getJobsCollection();

    const [pending, running, completed, failed] = await Promise.all([
      collection.countDocuments({ status: 'pending' }),
      collection.countDocuments({ status: 'running' }),
      collection.countDocuments({ status: 'completed' }),
      collection.countDocuments({ status: { $in: ['failed', 'retrying'] } }),
    ]);

    // Get recent jobs
    const recentJobs = await collection
      .find({})
      .sort({ updatedAt: -1 })
      .limit(20)
      .toArray();

    return NextResponse.json({
      queue: {
        pending,
        running,
        completed,
        failed,
        total: pending + running + completed + failed,
      },
      recentJobs: recentJobs.map(j => ({
        jobId: j.jobId,
        type: j.type,
        status: j.status,
        payload: j.payload,
        attempts: j.attempts,
        lastError: j.lastError,
        createdAt: j.createdAt,
        completedAt: j.completedAt,
      })),
    });
  } catch (error) {
    console.error('Error fetching job status:', error);
    return NextResponse.json({ error: 'Failed to fetch job status' }, { status: 500 });
  }
}
