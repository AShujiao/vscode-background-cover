
interface MapArr{
	//定义索引key为string类型，索引值为string类型
	[index:string]:string
}

let Color:MapArr = {
	"White": "255,255,255",
	"Black": "0,0,0",
	"Red": "255,0,0",
	"Blue": "0,0,255",
	"Yellow": "255,255,0",
	"Green": "0,255,0",
	"Orange": "255,165,0",
	"Pink": "255,192,203",
	"Purple": "160,32,240"
};



export default (color:string)=>{
	return Color[color];
}


export const getColorList = ()=>{
	return Object.keys(Color);
}