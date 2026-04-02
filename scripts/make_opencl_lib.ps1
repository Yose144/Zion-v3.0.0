$libexe = "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.44.35207\bin\HostX64\x64\lib.exe"
$outDir = "C:\Users\anaha\Desktop\ZION\opencl_sdk"

New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$def = @"
LIBRARY OpenCL
EXPORTS
clBuildProgram
clCloneKernel
clCompileProgram
clCreateBuffer
clCreateCommandQueue
clCreateCommandQueueWithProperties
clCreateContext
clCreateContextFromType
clCreateFromGLBuffer
clCreateFromGLRenderbuffer
clCreateFromGLTexture
clCreateFromGLTexture2D
clCreateFromGLTexture3D
clCreateImage
clCreateImage2D
clCreateImage3D
clCreateKernel
clCreateKernelsInProgram
clCreatePipe
clCreateProgramWithBinary
clCreateProgramWithBuiltInKernels
clCreateProgramWithIL
clCreateProgramWithSource
clCreateSampler
clCreateSamplerWithProperties
clCreateSubBuffer
clCreateSubDevices
clCreateUserEvent
clEnqueueAcquireGLObjects
clEnqueueBarrier
clEnqueueBarrierWithWaitList
clEnqueueCopyBuffer
clEnqueueCopyBufferRect
clEnqueueCopyBufferToImage
clEnqueueCopyImage
clEnqueueCopyImageToBuffer
clEnqueueFillBuffer
clEnqueueFillImage
clEnqueueMapBuffer
clEnqueueMapImage
clEnqueueMarker
clEnqueueMarkerWithWaitList
clEnqueueMigrateMemObjects
clEnqueueNDRangeKernel
clEnqueueNativeKernel
clEnqueueReadBuffer
clEnqueueReadBufferRect
clEnqueueReadImage
clEnqueueReleaseGLObjects
clEnqueueSVMFree
clEnqueueSVMMap
clEnqueueSVMMemFill
clEnqueueSVMMemcpy
clEnqueueSVMUnmap
clEnqueueTask
clEnqueueUnmapMemObject
clEnqueueWaitForEvents
clEnqueueWriteBuffer
clEnqueueWriteBufferRect
clEnqueueWriteImage
clFinish
clFlush
clGetCommandQueueInfo
clGetContextInfo
clGetDeviceAndHostTimer
clGetDeviceIDs
clGetDeviceInfo
clGetEventInfo
clGetEventProfilingInfo
clGetExtensionFunctionAddress
clGetExtensionFunctionAddressForPlatform
clGetGLContextInfoKHR
clGetGLObjectInfo
clGetGLTextureInfo
clGetHostTimer
clGetImageInfo
clGetKernelArgInfo
clGetKernelInfo
clGetKernelSubGroupInfo
clGetKernelWorkGroupInfo
clGetMemObjectInfo
clGetPipeInfo
clGetPlatformIDs
clGetPlatformInfo
clGetProgramBuildInfo
clGetProgramInfo
clGetSamplerInfo
clGetSupportedImageFormats
clLinkProgram
clReleaseCommandQueue
clReleaseContext
clReleaseDevice
clReleaseEvent
clReleaseKernel
clReleaseMemObject
clReleaseProgram
clReleaseSampler
clRetainCommandQueue
clRetainContext
clRetainDevice
clRetainEvent
clRetainKernel
clRetainMemObject
clRetainProgram
clRetainSampler
clSVMAlloc
clSVMFree
clSetDefaultDeviceCommandQueue
clSetEventCallback
clSetKernelArg
clSetKernelArgSVMPointer
clSetKernelExecInfo
clSetMemObjectDestructorCallback
clSetProgramReleaseCallback
clSetProgramSpecializationConstant
clSetUserEventStatus
clUnloadCompiler
clUnloadPlatformCompiler
clWaitForEvents
"@

$defPath = "$outDir\OpenCL.def"
$libPath = "$outDir\OpenCL.lib"

$def | Set-Content $defPath -Encoding ASCII
Write-Host "DEF written to $defPath"

Remove-Item $libPath -ErrorAction SilentlyContinue
& $libexe /def:$defPath /machine:x64 /out:$libPath
Write-Host "lib.exe exit: $LASTEXITCODE"

if (Test-Path $libPath) {
    Write-Host "SUCCESS: $libPath ($((Get-Item $libPath).Length) bytes)"
} else {
    Write-Host "FAILED: OpenCL.lib not created"
}
