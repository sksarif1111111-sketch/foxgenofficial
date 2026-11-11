DO $migration$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.shop_create_order_atomic(jsonb)'::regprocedure) INTO definition;
 IF position('status=CASE WHEN channel=' IN definition)=0 THEN
   RAISE EXCEPTION 'Expected wallet status expression not found';
 END IF;
 definition := replace(definition, 'status=CASE WHEN channel=', 'status=CASE WHEN shop_create_order_atomic.channel=');
 EXECUTE definition;
END
$migration$;