<?php
$tok = get_option('wpmelhorenvio_token');
$dest = ['Rio de Janeiro (capital)'=>'20040020','Niterói'=>'24020000','Petrópolis'=>'25610000','Volta Redonda'=>'27253000','Campos dos Goytacazes'=>'28010000',
 'São Paulo'=>'01310100','Belo Horizonte'=>'30130000','Vitória'=>'29010000','Curitiba'=>'80010000','Florianópolis'=>'88010000','Porto Alegre'=>'90010000',
 'Brasília'=>'70040000','Goiânia'=>'74003010','Campo Grande'=>'79002000','Cuiabá'=>'78005000','Salvador'=>'40010000','Recife'=>'50010000','Fortaleza'=>'60010000',
 'São Luís'=>'65010000','Belém'=>'66010000','Manaus'=>'69005000','Porto Velho'=>'76801000'];
$out = [];
foreach ([0.5, 1] as $kg) foreach ($dest as $nome => $cep) {
  $body = ['from'=>['postal_code'=>'21360360'],'to'=>['postal_code'=>$cep],
    'package'=>['height'=>10,'width'=>15,'length'=>20,'weight'=>$kg],'options'=>['insurance_value'=>50,'receipt'=>false,'own_hand'=>false]];
  $r = wp_remote_post('https://melhorenvio.com.br/api/v2/me/shipment/calculate', ['timeout'=>40,
    'headers'=>['Authorization'=>"Bearer $tok",'Accept'=>'application/json','Content-Type'=>'application/json','User-Agent'=>'Loja MVO'],'body'=>wp_json_encode($body)]);
  $j = json_decode(wp_remote_retrieve_body($r), true);
  foreach ((array)$j as $s) if (empty($s['error']) && isset($s['price']))
    $out[] = [$kg, $nome, $s['company']['name'].' '.$s['name'], (float)$s['price'], (int)$s['delivery_time']];
}
echo wp_json_encode($out);
