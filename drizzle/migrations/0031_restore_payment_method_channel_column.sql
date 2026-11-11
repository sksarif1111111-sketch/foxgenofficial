DO $migration$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.shop_create_order_atomic(jsonb)'::regprocedure) INTO definition;
 definition := replace(definition, 'm._buyer_channel', 'm.channel');
 EXECUTE definition;
END
$migration$;