import {createServerFn} from '@tanstack/react-start';
import {z} from 'zod';
import {requireAdminPassword} from './admin-access.middleware';
export const marketplaceInventory=createServerFn({method:'POST'}).middleware([requireAdminPassword]).inputValidator((v:unknown)=>z.object({productId:z.string().uuid()}).parse(v)).handler(async({data})=>{
  const {db}=await import('./hub.server');const r=await db.from('shop_inventory_items').select('id,status,order_id,created_at').eq('product_id',data.productId).order('created_at',{ascending:false}).limit(200);if(r.error)throw new Error('Could not read inventory');return r.data;
});
export const marketplaceAddInventory=createServerFn({method:'POST'}).middleware([requireAdminPassword]).inputValidator((v:unknown)=>z.object({productId:z.string().uuid(),items:z.array(z.string().trim().min(3).max(10000)).min(1).max(200)}).parse(v)).handler(async({data})=>{
  const {db,logActivity}=await import('./hub.server');const p=await db.from('products').select('product_type').eq('id',data.productId).maybeSingle();if(!p.data||['license_product','browser_extension'].includes(p.data.product_type))throw new Error('Extension licences use the existing licence manager, not bulk inventory.');
  const r=await db.from('shop_inventory_items').insert(data.items.map(content=>({product_id:data.productId,content})));if(r.error)throw new Error('Could not add inventory; duplicate items are not allowed.');await logActivity('inventory','Inventory added','success',`${data.items.length} items`);return {ok:true};
});
export const marketplaceAssignInventory=createServerFn({method:'POST'}).middleware([requireAdminPassword]).inputValidator((v:unknown)=>z.object({id:z.string().uuid()}).parse(v)).handler(async({data})=>{const{db}=await import('./hub.server');const r=await db.rpc('shop_assign_inventory',{_order:data.id});if(r.error)throw new Error(r.error.message);return {assigned:r.data};});
export const marketplaceGenerateImage=createServerFn({method:'POST'}).middleware([requireAdminPassword]).inputValidator((v:unknown)=>z.object({name:z.string().trim().min(1).max(120),description:z.string().max(4000).optional()}).parse(v)).handler(async({data})=>{
  const {generateProductImage}=await import('./product-image.server');return{url:await generateProductImage(data.name,data.description)};
});
export const marketplaceFillMissingImages=createServerFn({method:'POST'}).middleware([requireAdminPassword]).handler(async()=>{
  const {autoFillProductImages}=await import('./product-image.server');return autoFillProductImages(4);
});
