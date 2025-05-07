
interface MapArr{
	//定义索引key为string类型，索引值为string类型
	[index:string]:string
}

let Color: MapArr = {
	"White-白色": "255,255,255",
	"Black-黑色": "0,0,0",
	"Red-红色": "255,0,0",
	"Blue-蓝色": "0,0,255",
	"Yellow-黄色": "255,255,0",
	"Green-绿色": "0,255,0",
	"Orange-橙色": "255,165,0",
	"Pink-粉色": "255,192,203",
	"Purple-紫色": "160,32,240",
	"Gray-灰色": "128,128,128",
	"Brown-棕色": "165,42,42",
	"Teal-青色": "0,128,128",
	"Olive-橄榄色": "128,128,0",
	"Maroon-栗色": "128,0,0",
	"Coral-珊瑚色": "255,127,80",
	"Salmon-鲑鱼色": "250,128,114",
	"Turquoise-绿松石色": "64,224,208",
	"Violet-紫罗兰色": "238,130,238",
	"Indigo-靛蓝色": "75,0,130",
	"Gold-金色": "255,215,0",
	"Silver-银色": "192,192,192",
	"Plum-李子色": "221,160,221",
	"Khaki-卡其色": "240,230,140",
	"Peach-桃色": "255,218,185",
	"Mint-薄荷色": "189,252,201",
	"Lavender-薰衣草色": "230,230,250",
	"Beige-米色": "245,222,179",
	"Tan-棕褐色": "210,180,140",
	"Slate-石板色": "112,128,144",
	"Crimson-深红色": "220,20,60",
	"Chartreuse-黄绿色": "127,255,0",
	"Fuchsia-紫红色": "255,0,255",
	"Azure-天蓝色": "0,127,255",
	
};



export default (color:string)=>{
	return Color[color];
}


export const getColorList = ()=>{
	return Object.keys(Color);
}