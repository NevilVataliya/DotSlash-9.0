const asyncHandler = (requestHandler) =>{
    return (req,res,next)=>{
        Promise.resolve(requestHandler(req,res,next)).
        catch((err)=>next(err))
    }
}


export {asyncHandler}


// const asyncHandler = () =>{}
// const asyncHandler = (func) => () =>{}
// cosnt asyncHandler = (func)=>{()=>{}}  hum bs curly braces hta dete hai
// if want an async so write in front of this 
// const asyncHandler = (func) => async () =>{}



// same as above 


// const asyncHandler = (fn) => async (req,res,next) =>{
//     try{
//         await fn(req,res,next)
//     }
//     catch(error){
//         res.status(err.code || 500).json({
//             success:false,
//             message:err.message
//         })
//     }
// }