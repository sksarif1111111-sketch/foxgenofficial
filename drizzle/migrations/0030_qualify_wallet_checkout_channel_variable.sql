DO $migration$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.shop_create_order_atomic(jsonb)'::regprocedure) INTO definition;
 definition := replace(definition, 'channel text;', '_buyer_channel text;');
 definition := replace(definition, 'channel:=', '_buyer_channel:=');
 definition := replace(definition, 'channel NOT IN', '_buyer_channel NOT IN');
 definition := replace(definition, 'channel=', '_buyer_channel=');
 definition := replace(definition, 'm.channel<>channel', 'm.channel<>_buyer_channel');
 definition := replace(definition, 'channel<>', '_buyer_channel<>');
 definition := replace(definition, ',channel,''awaiting_payment''', ',_buyer_channel,''awaiting_payment''');
 definition := replace(definition, 'shop_create_order_atomic._buyer_channel', '_buyer_channel');
 EXECUTE definition;
END
$migration$;