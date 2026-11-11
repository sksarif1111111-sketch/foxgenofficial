import {createFileRoute} from '@tanstack/react-router';
import {authenticateCronRequest} from '@/integrations/supabase/cron-auth';
export const Route=createFileRoute('/api/public/cron/marketplace')({server:{handlers:{POST:async({request})=>{
  const denied=await authenticateCronRequest(request);if(denied)return denied;
  try{const{runMarketplaceJobs}=await import('@/lib/marketplace-jobs.server');return Response.json(await runMarketplaceJobs());}catch{return Response.json({ok:false,error:'JOBS_UNAVAILABLE'},{status:503});}
}}}});